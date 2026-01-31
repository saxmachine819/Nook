import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/venue-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { VenueBookingWidget } from "@/components/venue/VenueBookingWidget"
import { VenueImageCarousel } from "@/components/venue/VenueImageCarousel"
import { VenuePageHeader } from "@/components/venue/VenuePageHeader"
import { VenueHoursDisplay } from "@/components/venue/VenueHoursDisplay"
import { computeAvailabilityLabel } from "@/lib/availability-utils"
import { formatEligibilitySummary, generateDescription } from "@/lib/deal-utils"
import { DealType } from "@prisma/client"

function safeStringArray(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string" && v.length > 0)
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string" && v.length > 0)
    } catch {
      // ignore
    }
  }
  return []
}

interface VenuePageProps {
  params: { id: string }
  searchParams: { returnTo?: string }
}

export default async function VenuePage({ params, searchParams }: VenuePageProps) {
  // Get session for favorite state fetching
  const session = await auth()
  
  let venue
  try {
    venue = await prisma.venue.findUnique({
      where: { id: params.id },
      include: {
        tables: {
          include: {
            seats: true,
          },
        },
        venueHours: {
          orderBy: {
            dayOfWeek: "asc",
          },
        },
        deals: {
          where: { isActive: true },
          orderBy: [
            { featured: "desc" },
            { createdAt: "desc" },
          ],
          take: 1, // Get the primary deal (featured first, then most recent)
        },
      } as any,
    })
  } catch (error) {
    console.error("Error fetching venue:", error)
    throw error
  }

  if (!venue) {
    notFound()
  }

  // Soft-deleted venues are not viewable (404)
  if ((venue as any).status === "DELETED" || (venue as any).deletedAt) {
    notFound()
  }

  // Check if venue is approved - if not, only owner/admin can view
  const isOwner = session?.user?.id === venue.ownerId
  const userIsAdmin = session?.user ? isAdmin(session.user) : false
  const canView = venue.onboardingStatus === "APPROVED" || isOwner || userIsAdmin

  if (!canView) {
    // Redirect non-owners to Explore page
    redirect("/")
  }

  // Fetch favorite states in batch
  let favoriteStates = {
    venue: false,
    tables: new Set<string>(),
    seats: new Set<string>(),
  }

  if (session?.user?.id) {
    const userId = session.user.id
    const venueId = venue.id
    const tableIds = venue.tables.map((t) => t.id)
    const seatIds = venue.tables.flatMap((t) => t.seats.map((s) => s.id))

    const [venueFav, tableFavs, seatFavs] = await Promise.all([
      prisma.favoriteVenue.findUnique({
        where: {
          userId_venueId: {
            userId,
            venueId,
          },
        },
      }),
      tableIds.length > 0
        ? prisma.favoriteTable.findMany({
            where: {
              userId,
              venueId,
              tableId: { in: tableIds },
            },
          })
        : Promise.resolve([]),
      seatIds.length > 0
        ? prisma.favoriteSeat.findMany({
            where: {
              userId,
              venueId,
              seatId: { in: seatIds },
            },
          })
        : Promise.resolve([]),
    ])

    favoriteStates.venue = !!venueFav
    favoriteStates.tables = new Set(tableFavs.map((t) => t.tableId))
    favoriteStates.seats = new Set(seatFavs.map((s) => s.seatId))
  }
  
  // Ensure tables and seats arrays exist
  if (!venue.tables) {
    venue.tables = []
  }
  venue.tables = venue.tables.map(table => ({
    ...table,
    seats: table.seats || []
  }))

  // Calculate capacity: use actual Seat records if available, otherwise fall back to table.seatCount
  const capacity = venue.tables.reduce((sum, table) => {
    if (table.seats.length > 0) {
      return sum + table.seats.length
    }
    // Fallback for older venues without Seat records
    return sum + (table.seatCount || 0)
  }, 0)
  
  // Calculate price range based on booking modes
  // Min: cheapest individual seat price
  // Max: most expensive full table price (total, not per seat)
  const groupTables = venue.tables.filter(t => {
    const mode = (t as any).bookingMode
    return mode === "group" || mode === null || mode === undefined
  })
  const individualTables = venue.tables.filter(t => (t as any).bookingMode === "individual")
  
  // Min price: cheapest individual seat
  let minPrice = venue.hourlySeatPrice || 0
  if (individualTables.length > 0) {
    const individualSeats = individualTables.flatMap(t => t.seats)
    const seatPrices = individualSeats
      .map(seat => seat.pricePerHour)
      .filter(price => price && price > 0)
    if (seatPrices.length > 0) {
      minPrice = Math.min(...seatPrices)
    }
  }
  
  // Max price: most expensive full table (total table price)
  let maxPrice = venue.hourlySeatPrice || 0
  if (groupTables.length > 0) {
    const tablePrices = groupTables
      .map(t => (t as any).tablePricePerHour)
      .filter(price => price && price > 0)
    if (tablePrices.length > 0) {
      maxPrice = Math.max(...tablePrices)
    }
  }
  
  // If no group tables, max should be the most expensive individual seat
  if (groupTables.length === 0 && individualTables.length > 0) {
    const individualSeats = individualTables.flatMap(t => t.seats)
    const seatPrices = individualSeats
      .map(seat => seat.pricePerHour)
      .filter(price => price && price > 0)
    if (seatPrices.length > 0) {
      maxPrice = Math.max(...seatPrices)
    }
  }
  
  // If no individual tables, min should be the cheapest group table per seat
  if (individualTables.length === 0 && groupTables.length > 0) {
    const perSeatPrices = groupTables
      .map(t => {
        const tablePrice = (t as any).tablePricePerHour
        const seatCount = t.seats.length
        if (tablePrice && tablePrice > 0 && seatCount > 0) {
          return tablePrice / seatCount
        }
        return null
      })
      .filter((price): price is number => price !== null)
    if (perSeatPrices.length > 0) {
      minPrice = Math.min(...perSeatPrices)
    }
  }
  
  // Pricing description
  let pricingDescription = "Reserve seats by the hour."
  if (individualTables.length > 0 && groupTables.length === 0) {
    pricingDescription = "Reserve seats individually by the hour."
  } else if (groupTables.length > 0 && individualTables.length === 0) {
    pricingDescription = "Reserve entire tables by the hour."
  } else if (groupTables.length > 0 && individualTables.length > 0) {
    pricingDescription = "Reserve seats individually or entire tables by the hour."
  }

  // Filter to only individual booking mode tables for seat selection
  // Default to all tables if bookingMode is not set (backward compatibility)
  const individualTablesForBooking = venue.tables.filter(t => {
    const mode = (t as any).bookingMode
    return mode === "individual" || mode === null || mode === undefined
  })

  // Fetch reservations for availability calculation
  const now = new Date()
  const futureReservations = await prisma.reservation.findMany({
    where: {
      venueId: venue.id,
      status: { not: "cancelled" },
      endAt: { gte: now },
    },
    select: {
      startAt: true,
      endAt: true,
      seatCount: true,
    },
  })

  // Calculate availability label
  const venueWithHours = venue as any
  const venueHours = venueWithHours.venueHours || null
  const openingHoursJson = venueWithHours.openingHoursJson || null
  const availabilityLabel = computeAvailabilityLabel(
    capacity,
    futureReservations.map((r) => ({
      startAt: r.startAt,
      endAt: r.endAt,
      seatCount: r.seatCount,
    })),
    venueHours,
    openingHoursJson
  )

  const venueHeroImages: string[] = (() => {
    const images = new Set<string>()

    // Prefer venue-level images
    const hero = (venue as any).heroImageUrl
    if (typeof hero === "string" && hero.length > 0) images.add(hero)
    safeStringArray((venue as any).imageUrls).forEach((u) => images.add(u))

    // Fallback to table / seat images (if present) so the page still feels alive
    for (const t of venue.tables) {
      safeStringArray((t as any).imageUrls).forEach((u) => images.add(u))
      for (const s of t.seats ?? []) {
        safeStringArray((s as any).imageUrls).forEach((u) => images.add(u))
      }
      if (images.size >= 8) break
    }

    return Array.from(images).slice(0, 8)
  })()

  const googleMapsHref =
    typeof venue.address === "string" && venue.address.length > 0
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}`
      : null

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Photo panel */}
        <div className="space-y-4">
          {/* Venue header */}
          <VenuePageHeader 
            name={venue.name} 
            address={venue.address}
            returnTo={searchParams?.returnTo}
            isFavorited={favoriteStates.venue}
            venueId={venue.id}
            deal={(() => {
              const primaryDeal = (venue as any).deals && Array.isArray((venue as any).deals) && (venue as any).deals.length > 0 
                ? (venue as any).deals[0] 
                : null
              return primaryDeal || null
            })()}
          />

          {/* Tags - under address */}
          {(venue.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(venue.tags ?? []).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Photo */}
          <div className="relative overflow-hidden rounded-2xl border bg-muted">
            <VenueImageCarousel
              images={venueHeroImages}
              className="h-[260px] sm:h-[340px] lg:h-[560px]"
            />
            <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/5" />
            
            {/* Availability label bubble */}
            {availabilityLabel && (
              <span className="absolute top-3 right-3 z-10 rounded-full bg-background/90 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-primary shadow-sm">
                {availabilityLabel}
              </span>
            )}
          </div>
        </div>

        {/* Right column: deal (when two-column) + booking */}
        <div className="space-y-4 lg:pt-[140px]">
          {/* Deal at top of right column on lg+ (avoids overlap with name/address on medium widths) */}
          {(venue as any).deals?.[0] && (() => {
            const primaryDeal = (venue as any).deals[0]
            const eligibility = primaryDeal.eligibilityJson || {}
            const eligibilitySummary = formatEligibilitySummary(primaryDeal)
            const dealDescription = generateDescription(primaryDeal.type, eligibility)
            return (
              <div className="hidden lg:block">
                <Card className="overflow-hidden border border-primary/15 bg-gradient-to-br from-primary/5 to-primary/2 shadow-sm">
                  <CardContent className="p-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="flex-shrink-0 rounded-full bg-primary/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground whitespace-nowrap">
                          Deal
                        </span>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold tracking-tight text-foreground leading-tight line-clamp-1">
                            {primaryDeal.title}
                          </h3>
                          {eligibilitySummary && (
                            <p className="text-[10px] font-medium text-primary/90 mt-0.5 line-clamp-1">
                              {eligibilitySummary}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="rounded-lg border border-primary/10 bg-background/60 p-2">
                        <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                          {primaryDeal.description || dealDescription}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )
          })()}
          <Card className="overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-base">Reserve</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {pricingDescription}
                  </p>
                </div>
                <div className="text-right">
                  {minPrice === maxPrice ? (
                    <div className="text-lg font-semibold tracking-tight whitespace-nowrap">
                      ${minPrice.toFixed(0)}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        /hr
                      </span>
                    </div>
                  ) : (
                    <div className="text-lg font-semibold tracking-tight whitespace-nowrap">
                      ${minPrice.toFixed(0)}–${maxPrice.toFixed(0)}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        /hr
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <VenueBookingWidget
                venueId={venue.id}
                tables={individualTablesForBooking as any}
                favoritedTableIds={favoriteStates.tables}
                favoritedSeatIds={favoriteStates.seats}
              />
            </CardContent>
          </Card>

          {/* Details directly below booking */}
          <div className="space-y-4">
            <div className="h-px w-full bg-border" />

            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium tracking-tight">More details</h2>
              {googleMapsHref && (
                <Button asChild variant="ghost" size="sm" className="px-2">
                  <a href={googleMapsHref} target="_blank" rel="noreferrer">
                    Directions
                  </a>
                </Button>
              )}
            </div>

            {/* Hours */}
            <VenueHoursDisplay openingHoursJson={(venue as any).openingHoursJson} />

            {venue.rulesText && (
              <div className="rounded-xl border bg-background p-4">
                <div className="mb-2 text-xs font-medium text-muted-foreground">
                  House rules
                </div>
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {venue.rulesText}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Spacer for bottom nav */}
      <div className="h-24" />
    </div>
  )
}