"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
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
  dealBadge?: {
    title: string
    description: string
    type: string
    summary: string
  } | null
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
    dealBadge: v.dealBadge && typeof v.dealBadge === "object" && v.dealBadge !== null
      ? (v.dealBadge as { title: string; description: string; type: string; summary: string })
      : null,
  }
}

const FILTER_STORAGE_KEY = "nook_explore_filters"

// Helper function to load filters from localStorage (with SSR guard)
function loadFiltersFromStorage(): { searchQuery: string; filters: FilterState } {
  if (typeof window === "undefined") {
    return {
      searchQuery: "",
      filters: {
        tags: [],
        priceMin: null,
        priceMax: null,
        availableNow: false,
        seatCount: null,
        bookingMode: [],
        dealsOnly: false,
      },
    }
  }
  
  try {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        searchQuery: parsed.searchQuery || "",
        filters: {
          tags: Array.isArray(parsed.filters?.tags) ? parsed.filters.tags : [],
          priceMin: typeof parsed.filters?.priceMin === "number" ? parsed.filters.priceMin : null,
          priceMax: typeof parsed.filters?.priceMax === "number" ? parsed.filters.priceMax : null,
          availableNow: parsed.filters?.availableNow === true,
          seatCount: typeof parsed.filters?.seatCount === "number" ? parsed.filters.seatCount : null,
          bookingMode: Array.isArray(parsed.filters?.bookingMode) ? parsed.filters.bookingMode : [],
          dealsOnly: parsed.filters?.dealsOnly === true,
        },
      }
    }
  } catch (e) {
    console.error("Error loading filters from localStorage:", e)
  }
  
  return {
    searchQuery: "",
    filters: {
      tags: [],
      priceMin: null,
      priceMax: null,
      availableNow: false,
      seatCount: null,
      bookingMode: [],
      dealsOnly: false,
    },
  }
}

// Helper function to save filters to localStorage
function saveFiltersToStorage(searchQuery: string, filters: FilterState) {
  if (typeof window === "undefined") return
  
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
      searchQuery,
      filters,
    }))
  } catch (e) {
    console.error("Error saving filters to localStorage:", e)
  }
}

export function ExploreClient({ venues: initialVenues }: ExploreClientProps) {
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)
  
  // Initialize filters from localStorage on mount
  const initialFilterState = loadFiltersFromStorage()
  console.log("🚀 ExploreClient mounting, loaded filters from storage:", initialFilterState)
  const [searchQuery, setSearchQuery] = useState(initialFilterState.searchQuery)
  const [filters, setFilters] = useState<FilterState>(initialFilterState.filters)
  
  // Start with empty venues to avoid flash of wrong content
  // They'll be populated after filters are restored and search is performed
  const [venues, setVenues] = useState<Venue[]>([])
  const hasInitializedVenuesRef = useRef(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationState, setLocationState] = useState<LocationState>("idle")
  const hasRequestedLocationRef = useRef(false)
  const [isSearching, setIsSearching] = useState(false)
  const [isSearchingText, setIsSearchingText] = useState(false)
  const [isSearchingArea, setIsSearchingArea] = useState(false) // Track if we're searching by area (not text)
  
  const filtersRef = useRef<FilterState>(initialFilterState.filters)
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null)
  const [centerOnVenueId, setCenterOnVenueId] = useState<string | null>(null)
  const currentBoundsRef = useRef<{ north: number; south: number; east: number; west: number } | null>(null)
  const [shouldFitMapBounds, setShouldFitMapBounds] = useState<boolean>(false) // Signal to map that it should fit bounds
  const [mapRefreshTrigger, setMapRefreshTrigger] = useState<number>(0) // Increment to force map refresh
  
  // Keep filtersRef in sync with filters state and save to localStorage
  useEffect(() => {
    filtersRef.current = filters
    // Save filters to localStorage whenever they change
    saveFiltersToStorage(searchQuery, filters)
    console.log("📝 Filters state updated and saved to storage:", {
      dealsOnly: filters.dealsOnly,
      tagsCount: filters.tags.length,
      hasPriceFilter: filters.priceMin != null || filters.priceMax != null,
      hasSeatCount: filters.seatCount != null,
      bookingModeCount: filters.bookingMode.length,
      searchQuery
    })
  }, [filters, searchQuery])

  
  // Store performSearch in ref for verification and initial load
  const performSearchRef = useRef<((query: string, bounds?: { north: number; south: number; east: number; west: number } | null, currentFilters?: FilterState) => Promise<void>) | null>(null)

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
  const hasMapboxToken = !!mapboxToken

  useEffect(() => {
    setIsClient(true)
    // Location will be requested when user clicks "Center on me" button
  }, [])

  // Restore filters from localStorage when component mounts (e.g., navigating back)
  // This runs BEFORE initializing venues to avoid flash of wrong content
  useEffect(() => {
    if (typeof window === "undefined" || !isClient || hasInitializedVenuesRef.current) return
    
    const stored = loadFiltersFromStorage()
    
    const hasStoredFilters = stored.searchQuery.length > 0 || 
                            stored.filters.dealsOnly || 
                            stored.filters.tags.length > 0 || 
                            stored.filters.priceMin != null || 
                            stored.filters.priceMax != null || 
                            stored.filters.seatCount != null || 
                            stored.filters.bookingMode.length > 0 ||
                            stored.filters.availableNow
    
    if (hasStoredFilters) {
      const filtersMatch = 
        filters.dealsOnly === stored.filters.dealsOnly &&
        filters.tags.length === stored.filters.tags.length &&
        filters.tags.every(t => stored.filters.tags.includes(t)) &&
        filters.priceMin === stored.filters.priceMin &&
        filters.priceMax === stored.filters.priceMax &&
        filters.seatCount === stored.filters.seatCount &&
        filters.bookingMode.length === stored.filters.bookingMode.length &&
        filters.bookingMode.every(m => stored.filters.bookingMode.includes(m)) &&
        filters.availableNow === stored.filters.availableNow &&
        searchQuery === stored.searchQuery
      
      if (!filtersMatch) {
        console.log("🔄 Restoring filters from localStorage:", stored)
        
        setSearchQuery(stored.searchQuery)
        setFilters(stored.filters)
        filtersRef.current = stored.filters
        
        // Re-apply search with restored filters
        if (performSearchRef.current) {
          performSearchRef.current(stored.searchQuery, currentBoundsRef.current ?? undefined, stored.filters)
        }
      } else {
        // Filters match, but we still need to initialize venues
        // If we have active filters, search will be triggered by the initialVenues useEffect
        // Otherwise, set initial venues
        if (!hasStoredFilters && !hasInitializedVenuesRef.current) {
          setVenues(initialVenues)
          hasInitializedVenuesRef.current = true
        }
      }
    } else {
      // No stored filters, use initial venues
      if (!hasInitializedVenuesRef.current) {
        setVenues(initialVenues)
        hasInitializedVenuesRef.current = true
      }
    }
  }, [isClient, filters, searchQuery]) // Run when client becomes true (after mount)

  // Initialize venues after filters are restored (to avoid flash of wrong content)
  useEffect(() => {
    if (typeof window === "undefined" || hasInitializedVenuesRef.current) return
    
    const hasActiveFilters = filters.dealsOnly || filters.tags.length > 0 || 
                            filters.priceMin != null || filters.priceMax != null || 
                            filters.seatCount != null || filters.bookingMode.length > 0 ||
                            filters.availableNow || searchQuery.length > 0
    
    if (hasActiveFilters && performSearchRef.current) {
      // Filters are active, search will populate venues
      console.log("🔄 Initializing with active filters, will search")
      performSearchRef.current(searchQuery, currentBoundsRef.current ?? undefined, filters)
      hasInitializedVenuesRef.current = true
    } else if (!hasActiveFilters) {
      // No filters, use initialVenues
      console.log("🔄 Initializing with no filters, using initialVenues")
      setVenues(initialVenues)
      hasInitializedVenuesRef.current = true
    }
  }, [filters, searchQuery, initialVenues]) // Run when filters/searchQuery are ready

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
  
  // Auto-request location on mount (only once)
  useEffect(() => {
    if (isClient && !hasRequestedLocationRef.current && locationState === "idle" && !userLocation) {
      hasRequestedLocationRef.current = true
      requestLocation()
    }
  }, [isClient, locationState, userLocation])

  const handleSearchArea = async (bounds: {
    north: number
    south: number
    east: number
    west: number
  }) => {
    currentBoundsRef.current = bounds
    // Mark that we're searching by area (not text) to prevent auto-expand
    setIsSearchingArea(true)
    setIsSearching(true)
    try {
      // Use performSearch with skipSetIsSearchingText=true to prevent auto-expand
      await performSearch(searchQuery, bounds, filters, true)
    } catch (error) {
      console.error("Error in handleSearchArea:", error)
    } finally {
      setIsSearching(false)
      // Reset the flag after a longer delay to allow venues useEffect and auto-center checks to run with skipFitBounds=true
      // Use a longer delay to ensure all map operations complete before allowing auto-center again
      setTimeout(() => {
        setIsSearchingArea(false)
      }, 2000) // Increased to 2 seconds to ensure all map operations complete
    }
  }

  const performSearch = useCallback(async (
    query: string,
    bounds?: { north: number; south: number; east: number; west: number } | null,
    currentFilters?: FilterState,
    skipSetIsSearchingText?: boolean
  ) => {
    if (!skipSetIsSearchingText) {
      setIsSearchingText(true)
    }
    try {
      const params = new URLSearchParams()
      if (bounds) {
        params.append("north", bounds.north.toString())
        params.append("south", bounds.south.toString())
        params.append("east", bounds.east.toString())
        params.append("west", bounds.west.toString())
      }
      if (query.length > 0) params.append("q", query)
      const activeFilters = currentFilters ?? filtersRef.current
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
      if (activeFilters.dealsOnly) {
        params.append("dealsOnly", "true")
      }
      if (activeFilters.availableNow) {
        params.append("availableNow", "true")
      }

      const url = `/api/venues/search?${params.toString()}`
      console.log("🔍 Searching with filters:", { dealsOnly: activeFilters.dealsOnly, url, currentVenueCount: venues.length })
      const res = await fetch(url)
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        console.error("Failed to search venues:", data?.error)
        return
      }
      const raw = (data.venues ?? []) as Record<string, unknown>[]
      const newVenues = raw.map(normalizeVenue)
      console.log("✅ Received venues:", newVenues.length, "with dealsOnly:", activeFilters.dealsOnly)
      console.log("🗺️ Setting venues state, map should update...")
      console.log("📍 Venue IDs:", newVenues.map(v => v.id).slice(0, 5))
      console.log("🔍 Active filters when setting venues:", {
        dealsOnly: activeFilters.dealsOnly,
        tags: activeFilters.tags.length,
        priceMin: activeFilters.priceMin,
        priceMax: activeFilters.priceMax,
        seatCount: activeFilters.seatCount,
        bookingMode: activeFilters.bookingMode.length
      })
      setVenues(newVenues)
      // Force map refresh when search results update
      // CRITICAL: Don't refresh map during area search - it causes remount and zoom reset
      if (!skipSetIsSearchingText) {
        // Only refresh map for text searches, not area searches
        setMapRefreshTrigger(prev => prev + 1)
      }
    } catch (e) {
      console.error("Error searching venues:", e)
    } finally {
      if (!skipSetIsSearchingText) {
        setIsSearchingText(false)
      }
    }
  }, []) // Empty deps - use filtersRef.current and venues.length inside
  
  // Store performSearch in ref for initial load
  useEffect(() => {
    performSearchRef.current = performSearch
  }, [performSearch])
  
  // This is now handled in the URL params loading useEffect above

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query)
      if (query.length === 0) {
        const hasActive =
          filters.tags.length > 0 ||
          filters.priceMin != null ||
          filters.priceMax != null ||
          filters.seatCount != null ||
          filters.bookingMode.length > 0 ||
          filters.dealsOnly ||
          filters.availableNow
        if (!hasActive) {
          setIsSearchingText(false)
          if (currentBoundsRef.current) {
            await performSearch("", currentBoundsRef.current)
          } else {
            // Only reset to initialVenues if we truly have no filters and no search
            console.log("🔄 Resetting to initialVenues (no active filters, no search)")
            setVenues(initialVenues)
            // Force map refresh when clearing search
            setMapRefreshTrigger(prev => prev + 1)
          }
          return
        }
      }
      await performSearch(query, currentBoundsRef.current ?? undefined)
    },
    [initialVenues, filters]
  )

  const handleFiltersChange = useCallback((f: FilterState) => {
    setFilters(f)
  }, [])
  
  const handleApplyFilters = useCallback(async (appliedFilters?: FilterState) => {
    // Accept filters as parameter to avoid timing issues with ref updates
    const filtersToUse = appliedFilters ?? filtersRef.current
    console.log("🔍 Applying filters:", { appliedFilters: !!appliedFilters, filtersToUse })
    
    // Always update filter state if appliedFilters were passed
    // Filters will be saved to localStorage via the useEffect that watches filters
    if (appliedFilters) {
      console.log("📝 Setting filter state:", appliedFilters)
      setFilters(appliedFilters)
      filtersRef.current = appliedFilters
      // Signal to map that it should fit bounds (filters were actively changed)
      setShouldFitMapBounds(true)
      // Force map refresh by incrementing trigger
      setMapRefreshTrigger(prev => prev + 1)
    }
    
    // Perform search with the filters - this will update venues and trigger map refresh
    await performSearch(searchQuery, currentBoundsRef.current ?? undefined, filtersToUse)
  }, [searchQuery])

  const handleClearFilters = useCallback(async () => {
    const cleared: FilterState = {
      tags: [],
      priceMin: null,
      priceMax: null,
      availableNow: false,
      seatCount: null,
      bookingMode: [],
      dealsOnly: false,
    }
    setFilters(cleared)
    setSearchQuery("") // Also clear search query
    // Force map refresh when clearing filters
    setMapRefreshTrigger(prev => prev + 1)
    // Save cleared filters to localStorage
    saveFiltersToStorage("", cleared)
    if (searchQuery.length > 0 || currentBoundsRef.current) {
      await performSearch("", currentBoundsRef.current ?? undefined, cleared)
    } else {
      // Only reset to initialVenues when explicitly clearing all filters with no search/bounds
      console.log("🔄 Resetting to initialVenues (clear filters, no search/bounds)")
      setVenues(initialVenues)
    }
  }, [searchQuery, initialVenues])

  const activeFilterCount =
    filters.tags.length +
    (filters.priceMin != null ? 1 : 0) +
    (filters.priceMax != null ? 1 : 0) +
    (filters.availableNow ? 1 : 0) +
    (filters.seatCount != null ? 1 : 0) +
    filters.bookingMode.length +
    (filters.dealsOnly ? 1 : 0)

  // Generate individual filter chips
  const getFilterChips = () => {
    const chips: Array<{ id: string; label: string; onRemove: () => void }> = []
    
    if (filters.dealsOnly) {
      chips.push({
        id: "dealsOnly",
        label: "Venues with deals",
        onRemove: async () => {
          const newFilters = { ...filters, dealsOnly: false }
          setFilters(newFilters)
          filtersRef.current = newFilters
          setMapRefreshTrigger(prev => prev + 1)
          await performSearch(searchQuery, currentBoundsRef.current ?? undefined, newFilters)
        }
      })
    }
    
    filters.tags.forEach((tag) => {
      chips.push({
        id: `tag-${tag}`,
        label: tag,
        onRemove: async () => {
          const newFilters = { ...filters, tags: filters.tags.filter(t => t !== tag) }
          setFilters(newFilters)
          filtersRef.current = newFilters
          setMapRefreshTrigger(prev => prev + 1)
          await performSearch(searchQuery, currentBoundsRef.current ?? undefined, newFilters)
        }
      })
    })
    
    if (filters.priceMin != null) {
      chips.push({
        id: "priceMin",
        label: `Min: $${filters.priceMin}`,
        onRemove: async () => {
          const newFilters = { ...filters, priceMin: null }
          setFilters(newFilters)
          filtersRef.current = newFilters
          setMapRefreshTrigger(prev => prev + 1)
          await performSearch(searchQuery, currentBoundsRef.current ?? undefined, newFilters)
        }
      })
    }
    
    if (filters.priceMax != null) {
      chips.push({
        id: "priceMax",
        label: `Max: $${filters.priceMax}`,
        onRemove: async () => {
          const newFilters = { ...filters, priceMax: null }
          setFilters(newFilters)
          filtersRef.current = newFilters
          setMapRefreshTrigger(prev => prev + 1)
          await performSearch(searchQuery, currentBoundsRef.current ?? undefined, newFilters)
        }
      })
    }
    
    if (filters.seatCount != null) {
      chips.push({
        id: "seatCount",
        label: `${filters.seatCount}+ seats`,
        onRemove: async () => {
          const newFilters = { ...filters, seatCount: null }
          setFilters(newFilters)
          filtersRef.current = newFilters
          setMapRefreshTrigger(prev => prev + 1)
          await performSearch(searchQuery, currentBoundsRef.current ?? undefined, newFilters)
        }
      })
    }
    
    filters.bookingMode.forEach((mode) => {
      chips.push({
        id: `bookingMode-${mode}`,
        label: mode === "communal" ? "Communal" : "Full table",
        onRemove: async () => {
          const newFilters = { ...filters, bookingMode: filters.bookingMode.filter(m => m !== mode) }
          setFilters(newFilters)
          filtersRef.current = newFilters
          setMapRefreshTrigger(prev => prev + 1)
          await performSearch(searchQuery, currentBoundsRef.current ?? undefined, newFilters)
        }
      })
    })
    
    if (filters.availableNow) {
      chips.push({
        id: "availableNow",
        label: "Available now",
        onRemove: async () => {
          const newFilters = { ...filters, availableNow: false }
          setFilters(newFilters)
          filtersRef.current = newFilters
          setMapRefreshTrigger(prev => prev + 1)
          await performSearch(searchQuery, currentBoundsRef.current ?? undefined, newFilters)
        }
      })
    }
    
    return chips
  }

  const filterChips = getFilterChips()

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
            key={`map-${mapRefreshTrigger}`}
            venues={venuesWithLocation}
            userLocation={userLocation}
            onSelectVenue={(id) => {
              setSelectedVenueId(id)
              // Ensure filters persist when selecting a venue
            }}
            onMapClick={() => {
              setSelectedVenueId(null)
              // Ensure filters persist when clicking map
            }}
            onSearchArea={handleSearchArea}
            isSearching={isSearching}
            centerOnVenueId={centerOnVenueId}
            hasMapboxToken={hasMapboxToken}
            shouldFitBounds={shouldFitMapBounds}
            skipFitBounds={isSearchingArea}
            onBoundsFitted={() => {
              // Reset the flag after bounds are fitted
              setShouldFitMapBounds(false)
            }}
            onRequestLocation={requestLocation}
            locationState={locationState}
            isSearchingArea={isSearchingArea}
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
            {/* Filter chips */}
            {filterChips.length > 0 && (
              <div className="mx-4 flex flex-wrap gap-2">
                {filterChips.map((chip) => (
                  <div
                    key={chip.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/95 backdrop-blur-sm px-3 py-1.5 text-xs font-medium shadow-sm"
                  >
                    <span className="text-foreground">{chip.label}</span>
                    <button
                      type="button"
                      onClick={chip.onRemove}
                      className="ml-0.5 rounded-full hover:bg-muted p-0.5 transition-colors"
                      aria-label={`Remove ${chip.label} filter`}
                    >
                      <svg
                        className="h-3 w-3 text-muted-foreground"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <ResultsDrawer
            venues={venues}
            onSelectVenue={(id) => setSelectedVenueId(id)}
            onCenterOnVenue={handleCenterOnVenue}
            autoExpand={!isSearchingArea && (searchQuery.length > 0 || isSearchingText || activeFilterCount > 0)}
          />
          <VenuePreviewSheet
            open={!!selectedVenueId && !!selectedVenue}
            venue={selectedVenue ? {
              id: selectedVenue.id,
              name: selectedVenue.name,
              address: selectedVenue.address,
              city: selectedVenue.city,
              state: selectedVenue.state,
              minPrice: selectedVenue.minPrice,
              maxPrice: selectedVenue.maxPrice,
              tags: selectedVenue.tags,
              availabilityLabel: selectedVenue.availabilityLabel,
              imageUrls: selectedVenue.imageUrls,
              capacity: selectedVenue.capacity,
              rulesText: selectedVenue.rulesText,
              dealBadge: selectedVenue.dealBadge,
            } : null}
            initialSeatCount={filters.seatCount && filters.seatCount > 0 ? filters.seatCount : undefined}
            onClose={() => {
              console.log("🔒 Closing venue sheet, filters should persist:", filters)
              console.log("📍 Current venues count:", venues.length)
              console.log("🔍 Active filters:", {
                dealsOnly: filters.dealsOnly,
                tags: filters.tags.length,
                priceMin: filters.priceMin,
                priceMax: filters.priceMax,
                seatCount: filters.seatCount,
                bookingMode: filters.bookingMode.length
              })
              setSelectedVenueId(null)
              // Filters should remain in state and URL
              // Venues should NOT be reset - they should remain filtered
            }}
          />
        </>
      )}
    </div>
  )
}
