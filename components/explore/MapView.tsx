"use client"

import { MapboxMap } from "@/components/map/MapboxMap"

export interface MapViewVenue {
  id: string
  name: string
  address: string
  latitude: number | null
  longitude: number | null
  minPrice: number
  maxPrice: number
  availabilityLabel?: string
}

interface MapViewProps {
  venues: MapViewVenue[]
  userLocation: { lat: number; lng: number } | null
  onSelectVenue: (id: string) => void
  onMapClick: () => void
  onSearchArea: (bounds: { north: number; south: number; east: number; west: number }) => void
  isSearching: boolean
  centerOnVenueId: string | null
  hasMapboxToken: boolean
  shouldFitBounds?: boolean
  onBoundsFitted?: () => void
  onRequestLocation?: () => void
  locationState?: "idle" | "requesting" | "granted" | "denied" | "unavailable"
  skipFitBounds?: boolean
  isSearchingArea?: boolean
  onBoundsChange?: (bounds: { north: number; south: number; east: number; west: number }) => void
  onInitialBounds?: (bounds: { north: number; south: number; east: number; west: number }) => void
  didAreaSearch?: boolean
  /** When true (e.g. parent already has venues), skip loading overlay on remount */
  initialLoadingComplete?: boolean
}

export function MapView({
  venues,
  userLocation,
  onSelectVenue,
  onMapClick,
  onSearchArea,
  isSearching,
  centerOnVenueId,
  hasMapboxToken,
  shouldFitBounds,
  onBoundsFitted,
  onRequestLocation,
  locationState,
  skipFitBounds,
  isSearchingArea,
  onBoundsChange,
  onInitialBounds,
  didAreaSearch,
  initialLoadingComplete,
}: MapViewProps) {
  if (!hasMapboxToken) {
    return (
      <div className="fixed inset-0 z-0 flex items-center justify-center bg-muted/50">
        <div className="text-center px-6">
          <p className="text-sm text-muted-foreground">
            Map view unavailable. Mapbox access token not configured.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to your .env file
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-0">
      <MapboxMap
        venues={venues}
        onSelectVenue={onSelectVenue}
        onMapClick={onMapClick}
        userLocation={userLocation}
        onSearchArea={onSearchArea}
        isSearching={isSearching}
        centerOnVenueId={centerOnVenueId}
        shouldFitBounds={shouldFitBounds}
        onBoundsFitted={onBoundsFitted}
        onRequestLocation={onRequestLocation}
        locationState={locationState}
        skipFitBounds={skipFitBounds}
        isSearchingArea={isSearchingArea}
        onBoundsChange={onBoundsChange}
        onInitialBounds={onInitialBounds}
        didAreaSearch={didAreaSearch}
        initialLoadingComplete={initialLoadingComplete}
      />
    </div>
  )
}
