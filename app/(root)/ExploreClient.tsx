"use client"

import { useState, useEffect } from "react"
import { VenueCard } from "@/components/venue/VenueCard"
import { MapboxMap } from "@/components/map/MapboxMap"

interface Venue {
  id: string
  name: string
  address: string
  neighborhood?: string
  city?: string
  state?: string
  latitude: number | null
  longitude: number | null
  hourlySeatPrice: number
  tags: string[]
}

interface ExploreClientProps {
  venues: Venue[]
}

export function ExploreClient({ venues }: ExploreClientProps) {
  const [isClient, setIsClient] = useState(false)
  // Check for Mapbox access token
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
  const hasMapboxToken = !!mapboxToken

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Separate venues with and without coordinates
  const venuesWithLocation = venues.filter(
    (v) => v.latitude !== null && v.longitude !== null
  )
  const venuesWithoutLocation = venues.filter(
    (v) => v.latitude === null || v.longitude === null
  )

  // Debug: Log venue data
  useEffect(() => {
    console.log("Venues data:", {
      total: venues.length,
      withLocation: venuesWithLocation.length,
      withoutLocation: venuesWithoutLocation.length,
      sample: venues[0] ? { 
        name: venues[0].name, 
        lat: venues[0].latitude, 
        lng: venues[0].longitude 
      } : null
    })
  }, [venues, venuesWithLocation, venuesWithoutLocation])

  return (
    <div className="flex min-h-screen flex-col">
      <div className="container mx-auto px-4 py-6">
        <h1 className="mb-6 text-3xl font-semibold tracking-tight">Explore</h1>

        {/* Map Section */}
        {isClient && hasMapboxToken && (
          <div className="mb-8 h-[400px] w-full overflow-hidden rounded-lg border">
            <MapboxMap venues={venuesWithLocation} />
          </div>
        )}

        {isClient && !hasMapboxToken && (
          <div className="mb-8 flex h-[400px] w-full items-center justify-center rounded-lg border bg-muted/50">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Map view unavailable. Mapbox access token not configured.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to your .env file
              </p>
            </div>
          </div>
        )}

        {/* List Section */}
        <div className="space-y-4">
          {venuesWithLocation.map((venue) => (
            <VenueCard
              key={venue.id}
              id={venue.id}
              name={venue.name}
              address={venue.address}
              neighborhood={venue.neighborhood}
              city={venue.city}
              state={venue.state}
              hourlySeatPrice={venue.hourlySeatPrice}
              tags={venue.tags}
            />
          ))}

          {venuesWithoutLocation.map((venue) => (
            <VenueCard
              key={venue.id}
              id={venue.id}
              name={venue.name}
              address={venue.address}
              neighborhood={venue.neighborhood}
              city={venue.city}
              state={venue.state}
              hourlySeatPrice={venue.hourlySeatPrice}
              tags={venue.tags}
              missingLocation={true}
            />
          ))}

          {venues.length === 0 && (
            <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
              <p className="text-muted-foreground">No venues yet.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Be the first to onboard your venue!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}