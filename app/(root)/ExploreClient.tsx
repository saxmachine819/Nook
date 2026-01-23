"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { MapView } from "@/components/explore/MapView"
import { TopOverlayControls } from "@/components/explore/TopOverlayControls"
import { VenuePreviewSheet } from "@/components/explore/VenuePreviewSheet"
import { ResultsDrawer } from "@/components/explore/ResultsDrawer"
import { FilterState } from "@/components/explore/FilterPanel"
import { Button } from "@/components/ui/button"

interface Venue {
  id: string
  name: string
  address: string
  city?: string
  state?: string
  latitude: number | null
  longitude: number | null
  minPrice: number
  maxPrice: number
  tags: string[]
  capacity: number
  rulesText?: string
  availabilityLabel?: string
  imageUrls?: string[]
  hourlySeatPrice?: number
}

interface ExploreClientProps {
  venues: Venue[]
}

type LocationState = "idle" | "requesting" | "granted" | "denied" | "unavailable"

function normalizeVenue(v: Record<string, unknown>): Venue {
  const h = typeof v.hourlySeatPrice === "number" ? v.hourlySeatPrice : 0
  return {
    id: String(v.id),
    name: String(v.name ?? ""),
    address: String(v.address ?? ""),
    city: v.city != null ? String(v.city) : undefined,
    state: v.state != null ? String(v.state) : undefined,
    latitude: typeof v.latitude === "number" ? v.latitude : null,
    longitude: typeof v.longitude === "number" ? v.longitude : null,
    minPrice: typeof v.minPrice === "number" ? v.minPrice : h,
    maxPrice: typeof v.maxPrice === "number" ? v.maxPrice : h,
    tags: Array.isArray(v.tags) ? (v.tags as string[]) : [],
    capacity: typeof v.capacity === "number" ? v.capacity : 0,
    rulesText: v.rulesText != null ? String(v.rulesText) : undefined,
    availabilityLabel: v.availabilityLabel != null ? String(v.availabilityLabel) : undefined,
    imageUrls: Array.isArray(v.imageUrls) ? (v.imageUrls as string[]) : undefined,
    hourlySeatPrice: h,
  }
}

export function ExploreClient({ venues: initialVenues }: ExploreClientProps) {
  const [isClient, setIsClient] = useState(false)
  const [venues, setVenues] = useState<Venue[]>(initialVenues)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationState, setLocationState] = useState<LocationState>("idle")
  const [isSearching, setIsSearching] = useState(false)
  const [isSearchingText, setIsSearchingText] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filters, setFilters] = useState<FilterState>({
    tags: [],
    priceMin: null,
    priceMax: null,
    openNow: false,
    seatCount: null,
    bookingMode: [],
  })
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null)
  const [centerOnVenueId, setCenterOnVenueId] = useState<string | null>(null)
  const currentBoundsRef = useRef<{ north: number; south: number; east: number; west: number } | null>(null)

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

  const handleSearchArea = async (bounds: {
    north: number
    south: number
    east: number
    west: number
  }) => {
    currentBoundsRef.current = bounds
    setIsSearching(true)
    try {
      await performSearch(searchQuery, bounds, filters)
    } finally {
      setIsSearching(false)
    }
  }

  const performSearch = async (
    query: string,
    bounds?: { north: number; south: number; east: number; west: number } | null,
    currentFilters?: FilterState
  ) => {
    setIsSearchingText(true)
    try {
      const params = new URLSearchParams()
      if (bounds) {
        params.append("north", bounds.north.toString())
        params.append("south", bounds.south.toString())
        params.append("east", bounds.east.toString())
        params.append("west", bounds.west.toString())
      }
      if (query.length > 0) params.append("q", query)
      const activeFilters = currentFilters ?? filters
      if (activeFilters.tags.length > 0)
        params.append("tags", activeFilters.tags.join(","))
      if (activeFilters.priceMin != null)
        params.append("priceMin", activeFilters.priceMin.toString())
      if (activeFilters.priceMax != null)
        params.append("priceMax", activeFilters.priceMax.toString())
      if (activeFilters.seatCount != null)
        params.append("seatCount", activeFilters.seatCount.toString())
      if (activeFilters.bookingMode.length > 0)
        params.append("bookingMode", activeFilters.bookingMode.join(","))

      const res = await fetch(`/api/venues/search?${params.toString()}`)
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        console.error("Failed to search venues:", data?.error)
        return
      }
      const raw = (data.venues ?? []) as Record<string, unknown>[]
      setVenues(raw.map(normalizeVenue))
    } catch (e) {
      console.error("Error searching venues:", e)
    } finally {
      setIsSearchingText(false)
    }
  }

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query)
      if (query.length === 0) {
        const hasActive =
          filters.tags.length > 0 ||
          filters.priceMin != null ||
          filters.priceMax != null ||
          filters.seatCount != null ||
          filters.bookingMode.length > 0
        if (!hasActive) {
          setIsSearchingText(false)
          if (currentBoundsRef.current) {
            await performSearch("", currentBoundsRef.current)
          } else {
            setVenues(initialVenues)
          }
          return
        }
      }
      await performSearch(query, currentBoundsRef.current ?? undefined)
    },
    [initialVenues, filters]
  )

  const handleFiltersChange = useCallback((f: FilterState) => setFilters(f), [])
  const handleApplyFilters = useCallback(async () => {
    await performSearch(searchQuery, currentBoundsRef.current ?? undefined, filters)
  }, [searchQuery, filters])

  const handleClearFilters = useCallback(async () => {
    const cleared: FilterState = {
      tags: [],
      priceMin: null,
      priceMax: null,
      openNow: false,
      seatCount: null,
      bookingMode: [],
    }
    setFilters(cleared)
    if (searchQuery.length > 0 || currentBoundsRef.current) {
      await performSearch(searchQuery, currentBoundsRef.current ?? undefined, cleared)
    } else {
      setVenues(initialVenues)
    }
  }, [searchQuery, initialVenues])

  const activeFilterCount =
    filters.tags.length +
    (filters.priceMin != null ? 1 : 0) +
    (filters.priceMax != null ? 1 : 0) +
    (filters.openNow ? 1 : 0) +
    (filters.seatCount != null ? 1 : 0) +
    filters.bookingMode.length

  const venuesWithLocation = useMemo(
    () => venues.filter((v) => v.latitude != null && v.longitude != null),
    [venues]
  )

  const selectedVenue = selectedVenueId
    ? venues.find((v) => v.id === selectedVenueId) ?? null
    : null

  const handleCenterOnVenue = useCallback((id: string) => {
    setCenterOnVenueId(id)
  }, [])

  useEffect(() => {
    if (!centerOnVenueId) return
    const t = setTimeout(() => setCenterOnVenueId(null), 800)
    return () => clearTimeout(t)
  }, [centerOnVenueId])

  return (
    <div className="fixed inset-0 flex flex-col">
      {isClient && (
        <>
          <MapView
            venues={venuesWithLocation}
            userLocation={userLocation}
            onSelectVenue={(id) => setSelectedVenueId(id)}
            onMapClick={() => setSelectedVenueId(null)}
            onSearchArea={handleSearchArea}
            isSearching={isSearching}
            centerOnVenueId={centerOnVenueId}
            hasMapboxToken={hasMapboxToken}
          />
          <div className="fixed left-0 right-0 top-0 z-10 flex flex-col gap-2">
            <TopOverlayControls
              onSearch={handleSearch}
              filterPanelOpen={filterPanelOpen}
              onFilterPanelOpenChange={setFilterPanelOpen}
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onApplyFilters={handleApplyFilters}
              onClearFilters={handleClearFilters}
              activeFilterCount={activeFilterCount}
            />
            {locationState === "denied" && (
              <div className="mx-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-background/90 px-3 py-2 shadow-sm backdrop-blur">
                <p className="text-xs text-muted-foreground">
                  Enable location to see nearby workspaces
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={requestLocation}
                  className="shrink-0 text-xs"
                >
                  Try again
                </Button>
              </div>
            )}
          </div>
          <ResultsDrawer
            venues={venues}
            onSelectVenue={(id) => setSelectedVenueId(id)}
            onCenterOnVenue={handleCenterOnVenue}
          />
          <VenuePreviewSheet
            open={!!selectedVenueId && !!selectedVenue}
            venue={selectedVenue}
            onClose={() => setSelectedVenueId(null)}
          />
        </>
      )}
    </div>
  )
}
