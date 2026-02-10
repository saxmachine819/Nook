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
import {
  getCanonicalVenueHours,
  getOpenStatus,
  formatWeeklyHoursFromCanonical,
} from "@/lib/hours"
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
    const seatIds = (
      venue.tables as unknown as Array<{ id: string; seats: { id: string }[] }>
    ).flatMap((t) => t.seats.map((s) => s.id))

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
  ; (venue as any).tables = venue.tables.map((table: any) => ({
    ...table,
    seats: table.seats || [],
  }))

  // Calculate capacity: actual Seat records if available, otherwise fall back to table.seatCount
  const capacity = venue.tables.reduce((sum, table) => {
    const seats = (table as any).seats
    if (seats?.length > 0) {
      return sum + seats.length
    }
    return sum + ((table as any).seatCount || 0)
  }, 0)

  const groupTables = venue.tables.filter((t: any) => {
    const mode = t.bookingMode
    return mode === "group" || mode === null || mode === undefined
  })
  const individualTables = venue.tables.filter((t: any) => t.bookingMode === "individual")

  let minPrice = venue.hourlySeatPrice || 0
  if (individualTables.length > 0) {
    const individualSeats = individualTables.flatMap((t: any) => t.seats ?? [])
    const seatPrices = individualSeats
      .map(seat => seat.pricePerHour)
      .filter(price => price && price > 0)
    if (seatPrices.length > 0) {
      minPrice = Math.min(...seatPrices)
    }
  }

  let maxPrice = venue.hourlySeatPrice || 0
  if (groupTables.length > 0) {
    const tablePrices = groupTables
      .map(t => (t as any).tablePricePerHour)
      .filter(price => price && price > 0)
    if (tablePrices.length > 0) {
      maxPrice = Math.max(...tablePrices)
    }
  }

  if (groupTables.length === 0 && individualTables.length > 0) {
    const individualSeats = individualTables.flatMap((t: any) => t.seats ?? [])
    const seatPrices = individualSeats
      .map(seat => seat.pricePerHour)
      .filter(price => price && price > 0)
    if (seatPrices.length > 0) {
      maxPrice = Math.max(...seatPrices)
    }
  }

  if (individualTables.length === 0 && groupTables.length > 0) {
    const tablePrices = groupTables
      .map(t => (t as any).tablePricePerHour)
      .filter((price): price is number => !!price && price > 0)
    if (tablePrices.length > 0) {
      minPrice = Math.min(...tablePrices)
    }
  }

  let pricingDescription = "Reserve seats by the hour."
  if (individualTables.length > 0 && groupTables.length === 0) {
    pricingDescription = "Reserve seats individually by the hour."
  } else if (groupTables.length > 0 && individualTables.length === 0) {
    pricingDescription = "Reserve entire tables by the hour."
  } else if (groupTables.length > 0 && individualTables.length > 0) {
    pricingDescription = "Reserve seats individually or entire tables by the hour."
  }

  const individualTablesForBooking = venue.tables.filter(t => {
    const mode = (t as any).bookingMode
    return mode === "individual" || mode === null || mode === undefined
  })

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

  const canonical = await getCanonicalVenueHours(venue.id)
  const openStatus = canonical ? getOpenStatus(canonical, new Date()) : null
  const weeklyFormatted = canonical ? formatWeeklyHoursFromCanonical(canonical) : []
  const availabilityLabel = computeAvailabilityLabel(
    capacity,
    futureReservations.map((r) => ({
      startAt: r.startAt,
      endAt: r.endAt,
      seatCount: r.seatCount,
    })),
    openStatus,
    { timeZone: canonical?.timezone }
  )

  const venueHeroImages: string[] = (() => {
    const images = new Set<string>()
    const hero = (venue as any).heroImageUrl
    if (typeof hero === "string" && hero.length > 0) images.add(hero)
    safeStringArray((venue as any).imageUrls).forEach((u) => images.add(u))
    for (const t of venue.tables) {
      safeStringArray((t as any).imageUrls).forEach((u) => images.add(u))
      for (const s of (t as any).seats ?? []) {
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[1fr,400px] lg:items-start">
          <div className="space-y-10">
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

            <div className="relative overflow-hidden rounded-[2.5rem] bg-muted shadow-2xl">
              <VenueImageCarousel
                images={venueHeroImages}
                className="h-[300px] sm:h-[450px] lg:h-[650px]"
              />
              <div className="pointer-events-none absolute inset-0 rounded-[2.5rem] ring-1 ring-inset ring-black/5" />
              {availabilityLabel && (
                <span className="absolute top-6 left-6 z-10 rounded-full glass px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary shadow-2xl">
                  {availabilityLabel}
                </span>
              )}
            </div>

            {(venue.tags ?? []).length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {(venue.tags ?? []).map((tag: string) => (
                  <span
                    key={tag}
                    className="rounded-full bg-primary/5 border border-primary/10 px-4 py-1.5 text-xs font-bold text-primary/70 tracking-tight"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}


            <div className="space-y-6">
              <div className="h-px w-full bg-border/50" />

              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black tracking-tight text-foreground/80">The Space</h2>
                {googleMapsHref && (
                  <Button asChild variant="ghost" className="rounded-2xl font-bold bg-primary/5 hover:bg-primary/10 text-primary">
                    <a href={googleMapsHref || undefined} target="_blank" rel="noreferrer">
                      Get Directions
                    </a>
                  </Button>
                )}
              </div>

              <VenueHoursDisplay openStatus={openStatus} weeklyFormatted={weeklyFormatted} />

              {venue.rulesText && (
                <div className="rounded-[2rem] border-none bg-primary/[0.03] p-8 space-y-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-primary/40">
                    House rules
                  </div>
                  <p className="whitespace-pre-line text-sm font-medium leading-relaxed text-foreground/70">
                    {venue.rulesText}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6 lg:sticky lg:top-8">
            {(venue as any).deals?.[0] && (() => {
              const primaryDeal = (venue as any).deals[0]
              const eligibility = primaryDeal.eligibilityJson || {}
              const eligibilitySummary = formatEligibilitySummary(primaryDeal)
              const dealDescription = generateDescription(primaryDeal.type, eligibility)
              return (
                <div className="hidden lg:block">
                  <Card className="overflow-hidden border-none bg-emerald-500 shadow-xl shadow-emerald-500/20 rounded-[2rem]">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <span className="flex-shrink-0 rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                            Special Deal
                          </span>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-xl font-bold tracking-tight text-white leading-tight">
                            {primaryDeal.title}
                          </h3>
                          {eligibilitySummary && (
                            <p className="text-xs font-bold text-white/80">
                              {eligibilitySummary}
                            </p>
                          )}
                        </div>
                        <div className="rounded-2xl bg-white/10 p-4">
                          <p className="text-xs font-medium leading-relaxed text-white/90">
                            {primaryDeal.description || dealDescription}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )
            })()}

            <Card className="overflow-hidden border-none bg-white shadow-2xl rounded-[2.5rem]">
              <CardHeader className="p-8 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-2xl font-black tracking-tight">Reserve</CardTitle>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">
                      {pricingDescription}
                    </p>
                  </div>
                  <div className="text-right">
                    {minPrice === maxPrice ? (
                      <div className="text-3xl font-black tracking-tighter text-primary">
                        ${minPrice.toFixed(0)}
                        <span className="text-xs font-bold text-muted-foreground/40 ml-1 uppercase tracking-tighter">
                          /hr
                        </span>
                      </div>
                    ) : (
                      <div className="text-2xl font-black tracking-tighter text-primary">
                        ${minPrice.toFixed(0)}–${maxPrice.toFixed(0)}
                        <span className="text-xs font-bold text-muted-foreground/40 ml-1 uppercase tracking-tighter">
                          /hr
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-8 pt-2">
                <VenueBookingWidget
                  venueId={venue.id}
                  tables={individualTablesForBooking as any}
                  favoritedTableIds={favoriteStates.tables}
                  favoritedSeatIds={favoriteStates.seats}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="h-24" />
      </div>
    </div>

  )
}
