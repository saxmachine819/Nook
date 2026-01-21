import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { VenueBookingWidget } from "@/components/venue/VenueBookingWidget"

interface VenuePageProps {
  params: { id: string }
}

export default async function VenuePage({ params }: VenuePageProps) {
  const venue = await prisma.venue.findUnique({
    where: { id: params.id },
    include: {
      tables: true,
    },
  })

  if (!venue) {
    notFound()
  }

  const capacity = venue.tables.reduce((sum, table) => sum + table.seatCount, 0)

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
                ${venue.hourlySeatPrice.toFixed(0)}
                <span className="ml-1 text-base font-normal text-muted-foreground">
                  / seat / hour
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Reserve seats by the hour. Availability is based on total seats across all tables.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Capacity: {capacity} seats total
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
              hourlySeatPrice={venue.hourlySeatPrice}
              maxCapacity={capacity}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}