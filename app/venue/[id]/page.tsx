import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Wifi, Plug, Volume2 } from "lucide-react"

interface VenuePageProps {
  params: Promise<{ id: string }>
}

export default async function VenuePage({ params }: VenuePageProps) {
  const { id } = await params

  // Placeholder data - will be replaced with Prisma query
  const venue = {
    id,
    name: "The Cozy Corner",
    neighborhood: "Downtown",
    address: "123 Main Street",
    city: "San Francisco",
    state: "CA",
    pricePerHour: 12,
    description:
      "A calm, professional workspace perfect for focused work. Work-ready with reliable Wi-Fi and ample power outlets.",
    trustTags: [
      { label: "Wi-Fi", icon: Wifi },
      { label: "Outlets", icon: Plug },
      { label: "Quiet", icon: Volume2 },
    ],
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight">
          {venue.name}
        </h1>
        <p className="text-muted-foreground">
          {venue.neighborhood} • {venue.city}, {venue.state}
        </p>
      </div>

      <div className="mb-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Pricing</CardTitle>
              <div className="text-2xl font-semibold">
                ${venue.pricePerHour}
                <span className="ml-1 text-base font-normal text-muted-foreground">
                  / seat / hour
                </span>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      {venue.description && (
        <div className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{venue.description}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle>What's included</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {venue.trustTags.map((tag) => {
                const Icon = tag.icon
                return (
                  <div
                    key={tag.label}
                    className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tag.label}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Availability</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Select a time to view availability and reserve a seat.
            </p>
            {/* Availability picker will be added here */}
          </CardContent>
        </Card>
      </div>

      <div className="sticky bottom-4 z-10 pb-4">
        <Button className="w-full" size="lg">
          Reserve a seat
        </Button>
      </div>
    </div>
  )
}