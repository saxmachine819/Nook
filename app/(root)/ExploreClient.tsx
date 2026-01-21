"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { VenueCard } from "@/components/venue/VenueCard"
import { MapboxMap } from "@/components/map/MapboxMap"
import { Button } from "@/components/ui/button"

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
  capacity: number
  rulesText?: string
  availabilityLabel?: string
}

interface ExploreClientProps {
  venues: Venue[]
}

type LocationState = "idle" | "requesting" | "granted" | "denied" | "unavailable"

export function ExploreClient({ venues: initialVenues }: ExploreClientProps) {
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null)
  const [venues, setVenues] = useState<Venue[]>(initialVenues)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationState, setLocationState] = useState<LocationState>("idle")
  const [isSearching, setIsSearching] = useState(false)

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
  const hasMapboxToken = !!mapboxToken

  useEffect(() => {
    setIsClient(true)
    requestLocation()
  }, [])

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationState("unavailable")
      return
    }

    setLocationState("requesting")

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setLocationState("granted")
      },
      (error) => {
        console.error("Geolocation error:", error)
        setLocationState("denied")
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }

  const handleSearchArea = async (bounds: { north: number; south: number; east: number; west: number }) => {
    setIsSearching(true)

    try {
      const params = new URLSearchParams({
        north: bounds.north.toString(),
        south: bounds.south.toString(),
        east: bounds.east.toString(),
        west: bounds.west.toString(),
      })

      const response = await fetch(`/api/venues/search?${params.toString()}`)
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        console.error("Failed to search venues:", data?.error)
        setIsSearching(false)
        return
      }

      setVenues(data.venues || [])
    } catch (error) {
      console.error("Error searching venues:", error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleBookingSuccess = async () => {
    // Refresh the page data to update availability labels
    router.refresh()
  }

  const selectedVenue = selectedVenueId ? venues.find((v) => v.id === selectedVenueId) || null : null

  // Separate venues with and without coordinates
  // Memoize these arrays so they don't create new references on every render
  // This prevents the infinite loop in MapboxMap's useEffect dependency
  const venuesWithLocation = useMemo(
    () => venues.filter((v) => v.latitude !== null && v.longitude !== null),
    [venues]
  )
  const venuesWithoutLocation = useMemo(
    () => venues.filter((v) => v.latitude === null || v.longitude === null),
    [venues]
  )

  return (
    <div className="flex min-h-screen flex-col">
      <div className="container mx-auto px-4 py-6">
        <h1 className="mb-6 text-3xl font-semibold tracking-tight">Explore</h1>

        {/* Location permission message */}
        {isClient && locationState === "denied" && (
          <div className="mb-4 rounded-lg border border-muted bg-muted/30 px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Enable location to see nearby workspaces
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={requestLocation}
                className="text-xs"
              >
                Try again
              </Button>
            </div>
          </div>
        )}

        {/* Map Section */}
        {isClient && hasMapboxToken && (
          <div className="mb-8 h-[400px] w-full overflow-hidden rounded-lg border">
            <MapboxMap
              venues={venuesWithLocation}
              onSelectVenue={(id) => setSelectedVenueId(id)}
              userLocation={userLocation}
              onSearchArea={handleSearchArea}
              isSearching={isSearching}
            />
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
          {venuesWithLocation.map((venue) => {
            const isSelected = selectedVenueId === venue.id
            const shouldDim = !!selectedVenueId && !isSelected
            return (
              <div
                key={venue.id}
                className={[
                  "transition-all duration-200",
                  shouldDim ? "opacity-55" : "opacity-100",
                ].join(" ")}
              >
                <VenueCard
                  id={venue.id}
                  name={venue.name}
                  address={venue.address}
                  neighborhood={venue.neighborhood}
                  city={venue.city}
                  state={venue.state}
                  hourlySeatPrice={venue.hourlySeatPrice}
                  tags={venue.tags}
                  capacity={venue.capacity}
                  rulesText={venue.rulesText}
                  availabilityLabel={venue.availabilityLabel}
                  isExpanded={isSelected}
                  isDeemphasized={shouldDim}
                  onSelect={() => setSelectedVenueId(venue.id)}
                  onClose={() => setSelectedVenueId(null)}
                  onBookingSuccess={handleBookingSuccess}
                />
              </div>
            )
          })}

          {venuesWithoutLocation.map((venue) => {
            const isSelected = selectedVenueId === venue.id
            const shouldDim = !!selectedVenueId && !isSelected
            return (
              <div
                key={venue.id}
                className={[
                  "transition-all duration-200",
                  shouldDim ? "opacity-55" : "opacity-100",
                ].join(" ")}
              >
                <VenueCard
                  id={venue.id}
                  name={venue.name}
                  address={venue.address}
                  neighborhood={venue.neighborhood}
                  city={venue.city}
                  state={venue.state}
                  hourlySeatPrice={venue.hourlySeatPrice}
                  tags={venue.tags}
                  capacity={venue.capacity}
                  rulesText={venue.rulesText}
                  availabilityLabel={venue.availabilityLabel}
                  missingLocation={true}
                  isExpanded={isSelected}
                  isDeemphasized={shouldDim}
                  onSelect={() => setSelectedVenueId(venue.id)}
                  onClose={() => setSelectedVenueId(null)}
                  onBookingSuccess={handleBookingSuccess}
                />
              </div>
            )
          })}

          {venues.length === 0 && (
            <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
              <p className="text-muted-foreground">No workspaces in this area yet.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Try searching a different area or be the first to onboard your venue!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
