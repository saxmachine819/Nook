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
  // Fetch venue data in parallel with other essential checks
  const [venue, session, canonicalHours] = await Promise.all([
    prisma.venue.findUnique({
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
          take: 1,
        },
      } as any,
    }),
    auth(),
    getCanonicalVenueHours(params.id),
  ])

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
    redirect("/")
  }
  
  // Ensure tables and seats arrays exist
  if (!venue.tables) {
    venue.tables = []
  }
  ;(venue as any).tables = venue.tables.map((table: any) => ({
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

  const openStatus = canonicalHours ? getOpenStatus(canonicalHours, new Date()) : null
  const weeklyFormatted = canonicalHours ? formatWeeklyHoursFromCanonical(canonicalHours) : []
  
  // We'll delegate full availability calculations to the client (VenueBookingWidget)
  // For the server render, we just show a basic status.
  const availabilityLabel = openStatus?.isOpen ? "Open" : "Closed"

  const venueHeroImages: string[] = (() => {
    const hero = (venue as any).heroImageUrl
    const rest = safeStringArray((venue as any).imageUrls).filter((u) => u !== hero)
    const combined = typeof hero === "string" && hero.length > 0 ? [hero, ...rest] : rest
    return combined.slice(0, 8)
  })()

  const googleMapsHref =
    typeof venue.address === "string" && venue.address.length > 0
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}`
      : null

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
          <VenuePageHeader 
            name={venue.name} 
            address={venue.address}
            returnTo={searchParams?.returnTo}
            venueId={venue.id}
            deal={(() => {
              const primaryDeal = (venue as any).deals && Array.isArray((venue as any).deals) && (venue as any).deals.length > 0 
                ? (venue as any).deals[0] 
                : null
              return primaryDeal || null
            })()}
          />

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

          <div className="relative overflow-hidden rounded-2xl border bg-muted">
            <VenueImageCarousel
              images={venueHeroImages}
              className="h-[260px] sm:h-[340px] lg:h-[560px]"
            />
            <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/5" />
            {availabilityLabel && (
              <span className="absolute top-3 right-3 z-10 rounded-full bg-background/90 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-primary shadow-sm">
                {availabilityLabel}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4 lg:pt-[140px]">
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
                canonicalHours={canonicalHours}
              />
            </CardContent>
          </Card>

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

            <VenueHoursDisplay
              openStatus={openStatus}
              weeklyFormatted={weeklyFormatted}
              venueTimezone={canonicalHours?.timezone ?? null}
              weeklyHours={canonicalHours?.weeklyHours ?? []}
            />

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

      <div className="h-24" />
    </div>
  )
}
