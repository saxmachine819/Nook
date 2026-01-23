import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { VenueBookingWidget } from "@/components/venue/VenueBookingWidget"
import { VenueImageCarousel } from "@/components/venue/VenueImageCarousel"

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

function roundUpToNext15Minutes(date: Date): Date {
  const result = new Date(date)
  const minutes = result.getMinutes()
  const remainder = minutes % 15
  if (remainder !== 0) {
    result.setMinutes(minutes + (15 - remainder), 0, 0)
  } else if (result.getSeconds() > 0 || result.getMilliseconds() > 0) {
    result.setMinutes(minutes + 15, 0, 0)
  } else {
    result.setSeconds(0, 0)
  }
  return result
}

function formatTimeLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function computeAvailabilityLabel(
  capacity: number,
  reservations: { startAt: Date; endAt: Date; seatCount: number }[]
): string {
  if (capacity <= 0) return "Sold out for now"

  const now = new Date()
  const startBase = roundUpToNext15Minutes(now)
  const horizonMs = 12 * 60 * 60 * 1000 // 12 hours
  const slotMs = 15 * 60 * 1000 // 15 minutes

  for (let offset = 0; offset < horizonMs; offset += slotMs) {
    const windowStart = new Date(startBase.getTime() + offset)
    const windowEnd = new Date(windowStart.getTime() + 60 * 60 * 1000) // 1 hour window

    const bookedSeats = reservations.reduce((sum, res) => {
      if (res.startAt < windowEnd && res.endAt > windowStart) {
        return sum + res.seatCount
      }
      return sum
    }, 0)

    if (bookedSeats < capacity) {
      if (offset === 0) {
        return "Available now"
      }
      return `Next available at ${formatTimeLabel(windowStart)}`
    }
  }

  return "Sold out for now"
}

interface VenuePageProps {
  params: { id: string }
}

export default async function VenuePage({ params }: VenuePageProps) {
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
      },
    })
  } catch (error) {
    console.error("Error fetching venue:", error)
    throw error
  }

  if (!venue) {
    notFound()
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
  const availabilityLabel = computeAvailabilityLabel(
    capacity,
    futureReservations.map((r) => ({
      startAt: r.startAt,
      endAt: r.endAt,
      seatCount: r.seatCount,
    }))
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
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {venue.name}
            </h1>
            {venue.address && (
              <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">
                {venue.address}
              </p>
            )}
          </div>

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

        {/* Booking card */}
        <div className="space-y-4">
          {(venue.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(venue.tags ?? []).slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

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
                    <div className="text-2xl font-semibold tracking-tight">
                      ${minPrice.toFixed(0)}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        /hr
                      </span>
                    </div>
                  ) : (
                    <div className="text-2xl font-semibold tracking-tight">
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

            {(venue.tags ?? []).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(venue.tags ?? []).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

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