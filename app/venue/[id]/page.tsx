import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { VenueBookingWidget } from "@/components/venue/VenueBookingWidget"

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

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight">
          {venue.name}
        </h1>
        {venue.address && (
          <p className="text-sm text-muted-foreground">
            {venue.address}
          </p>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {venue.tags?.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mb-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Pricing</CardTitle>
              <div className="text-2xl font-semibold">
                {minPrice === maxPrice ? (
                  <>
                    ${minPrice.toFixed(0)}
                    <span className="ml-1 text-base font-normal text-muted-foreground">
                      / seat / hour
                    </span>
                  </>
                ) : (
                  <>
                    ${minPrice.toFixed(0)}
                    <span className="ml-1 text-base font-normal text-muted-foreground">
                      / seat / hour
                    </span>
                    <span className="mx-2 text-base font-normal text-muted-foreground">—</span>
                    ${maxPrice.toFixed(0)}
                    <span className="ml-1 text-base font-normal text-muted-foreground">
                      / table / hour
                    </span>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {pricingDescription}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Capacity: {capacity} seats total
              {groupTables.length > 0 && individualTables.length > 0 && (
                <span className="ml-2">
                  ({groupTables.length} group table{groupTables.length > 1 ? "s" : ""}, {individualTables.length} individual table{individualTables.length > 1 ? "s" : ""})
                </span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {venue.rulesText && (
        <div className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle>House rules</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-sm text-muted-foreground">
                {venue.rulesText}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mb-24">
        <Card>
          <CardHeader>
            <CardTitle>Reserve seats</CardTitle>
          </CardHeader>
          <CardContent>
            <VenueBookingWidget
              venueId={venue.id}
              tables={individualTablesForBooking as any}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}