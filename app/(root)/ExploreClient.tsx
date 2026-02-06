"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { MapView } from "@/components/explore/MapView"
import { TopOverlayControls } from "@/components/explore/TopOverlayControls"
import { ExploreWelcomeBanner } from "@/components/ExploreWelcomeBanner"
import { safeSet } from "@/lib/storage"
import { VenuePreviewSheet } from "@/components/explore/VenuePreviewSheet"
import { ResultsDrawer } from "@/components/explore/ResultsDrawer"
import { FilterState } from "@/components/explore/FilterPanel"
import { Button } from "@/components/ui/button"
import { LoadingOverlay } from "@/components/ui/loading-overlay"

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
  /** From hours engine: OPEN_NOW | CLOSED_NOW | OPENS_LATER | CLOSED_TODAY; use for map pin color. */
  openStatus?: { status: string; todayHoursText: string } | null
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
  favoritedVenueIds?: Set<string>
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
    openStatus:
      v.openStatus && typeof v.openStatus === "object" && v.openStatus !== null
        ? { status: String((v.openStatus as { status?: string }).status ?? ""), todayHoursText: String((v.openStatus as { todayHoursText?: string }).todayHoursText ?? "") }
        : undefined,
    imageUrls: Array.isArray(v.imageUrls) ? (v.imageUrls as string[]) : undefined,
    hourlySeatPrice: h,
    dealBadge: v.dealBadge && typeof v.dealBadge === "object" && v.dealBadge !== null
      ? (v.dealBadge as { title: string; description: string; type: string; summary: string })
      : null,
  }
}

const FILTER_STORAGE_KEY = "nooc_explore_filters"

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
        favoritesOnly: false,
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
          favoritesOnly: parsed.filters?.favoritesOnly === true,
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
      favoritesOnly: false,
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

export function ExploreClient({ venues: initialVenues, favoritedVenueIds = new Set() }: ExploreClientProps) {
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
  const [favoritedVenueIdsState, setFavoritedVenueIdsState] = useState<Set<string>>(favoritedVenueIds)
  const hasInitializedVenuesRef = useRef(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationState, setLocationState] = useState<LocationState>("idle")
  const hasRequestedLocationRef = useRef(false)
  const [mapReady, setMapReady] = useState(false) // Gate map until location resolved or timeout
  const [isSearching, setIsSearching] = useState(false)
  const [isSearchingText, setIsSearchingText] = useState(false)
  const [isSearchingArea, setIsSearchingArea] = useState(false) // Track if we're searching by area (not text)
  
  const filtersRef = useRef<FilterState>(initialFilterState.filters)
  const searchQueryRef = useRef<string>(initialFilterState.searchQuery)
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null)
  const [venueLoadingOverlay, setVenueLoadingOverlay] = useState(false)
  const [centerOnVenueId, setCenterOnVenueId] = useState<string | null>(null)
  const currentBoundsRef = useRef<{ north: number; south: number; east: number; west: number } | null>(null)
  const hasReceivedInitialBoundsRef = useRef(false)
  const [shouldFitMapBounds, setShouldFitMapBounds] = useState<boolean>(false) // Signal to map that it should fit bounds
  const [mapRefreshTrigger, setMapRefreshTrigger] = useState<number>(0) // Increment to force map refresh
  const didAreaSearchRef = useRef(false) // Track if we just completed an area search (synchronous, no batching delay)
  const [debugBounds, setDebugBounds] = useState<{ north: number; south: number; east: number; west: number } | null>(null)
  const venuesCountRef = useRef(0) // Current venue count for performSearch (avoid remount on first load)

  // Keep filtersRef and searchQueryRef in sync and save to localStorage
  useEffect(() => {
    filtersRef.current = filters
    searchQueryRef.current = searchQuery
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

  useEffect(() => {
    venuesCountRef.current = venues.length
  }, [venues])

  // Store performSearch in ref for verification and initial load
  const performSearchRef = useRef<((query: string, bounds?: { north: number; south: number; east: number; west: number } | null, currentFilters?: FilterState, skipSetIsSearchingText?: boolean, isInitialLoad?: boolean) => Promise<void>) | null>(null)

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
                            stored.filters.favoritesOnly ||
                            stored.filters.tags.length > 0 || 
                            stored.filters.priceMin != null || 
                            stored.filters.priceMax != null || 
                            stored.filters.seatCount != null || 
                            stored.filters.bookingMode.length > 0 ||
                            stored.filters.availableNow
    
    if (hasStoredFilters) {
      const filtersMatch = 
        filters.dealsOnly === stored.filters.dealsOnly &&
        filters.favoritesOnly === stored.filters.favoritesOnly &&
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
        
        // Re-apply search with restored filters (full DB; don't send bounds)
        if (performSearchRef.current) {
          performSearchRef.current(stored.searchQuery, undefined, stored.filters)
        }
      }
    }
    // No stored filters: venues stay [] until onInitialBounds triggers bounded fetch
  }, [isClient, filters, searchQuery]) // Run when client becomes true (after mount)

  const OUTCOME_KEY = "nooc_location_last_outcome_v1"

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationState("unavailable")
      safeSet(OUTCOME_KEY, "unavailable")
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
        safeSet(OUTCOME_KEY, "granted")
      },
      (error) => {
        console.error("Geolocation error:", error)
        const outcome =
          error.code === 1 ? "denied" : error.code === 2 || error.code === 3 ? "error" : "unknown"
        setLocationState("denied")
        safeSet(OUTCOME_KEY, outcome)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }
  
  // Location is requested only when user clicks "Use my location" (map button or banner CTA)

  // Gate map until ready: show immediately when idle (no auto-request), or when location resolved
  useEffect(() => {
    if (!isClient) return
    if (
      locationState === "idle" ||
      userLocation !== null ||
      locationState === "denied" ||
      locationState === "unavailable"
    ) {
      setMapReady(true)
    }
  }, [isClient, userLocation, locationState])

  const handleSearchArea = async (bounds: {
    north: number
    south: number
    east: number
    west: number
  }) => {
    currentBoundsRef.current = bounds
    if (process.env.NODE_ENV !== "production") setDebugBounds(bounds)
    // Mark that we're searching by area (not text) to prevent auto-expand
    setIsSearchingArea(true)
    setIsSearching(true)
    // Set ref immediately (synchronous, no batching delay) so map can read it
    didAreaSearchRef.current = true
    try {
      // Use performSearch with skipSetIsSearchingText=true to prevent auto-expand
      await performSearch(searchQuery, bounds, filters, true)
    } catch (error) {
      console.error("Error in handleSearchArea:", error)
    } finally {
      setIsSearching(false)
      // Clear the ref after delay so map's interval has time to see loaded() and run repaint
      setTimeout(() => {
        didAreaSearchRef.current = false
      }, 2000)
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
    skipSetIsSearchingText?: boolean,
    isInitialLoad?: boolean
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
      if (activeFilters.favoritesOnly) {
        params.append("favoritesOnly", "true")
      }
      if (activeFilters.availableNow) {
        params.append("availableNow", "true")
      }

      const url = `/api/venues/search?${params.toString()}`
      if (process.env.NODE_ENV !== "production") {
        const trigger = skipSetIsSearchingText ? "search_area" : (bounds ? "filters" : "initial")
        console.log("[Explore search] request", {
          trigger,
          hasBounds: !!bounds,
          bounds: bounds ?? null,
          q: query || "(none)",
          url,
        })
      }
      console.log("🔍 Searching with filters:", { dealsOnly: activeFilters.dealsOnly, url, currentVenueCount: venues.length })
      const res = await fetch(url)
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        console.error("Failed to search venues:", data?.error)
        return
      }
      const raw = (data.venues ?? []) as Record<string, unknown>[]
      const normalized = raw.map(normalizeVenue)
      const newVenues = normalized.filter((v) => v.latitude != null && v.longitude != null)
      if (process.env.NODE_ENV !== "production") {
        console.log("[Explore search] response", {
          total: newVenues.length,
          first3: newVenues.slice(0, 3).map((v) => ({ id: v.id, lat: v.latitude, lng: v.longitude })),
        })
      }
      const favoritedIds = Array.isArray(data.favoritedVenueIds) 
        ? new Set(data.favoritedVenueIds as string[])
        : new Set<string>()
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
      // Update favorite states from search results
      // Merge with existing favorites to preserve favorites from initial page load
      setFavoritedVenueIdsState(prev => {
        const merged = new Set([...prev, ...favoritedIds])
        return merged
      })
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

  const handleInitialBounds = useCallback(
    (bounds: { north: number; south: number; east: number; west: number }) => {
      if (hasReceivedInitialBoundsRef.current) return
      hasReceivedInitialBoundsRef.current = true
      currentBoundsRef.current = bounds
      if (process.env.NODE_ENV !== "production") setDebugBounds(bounds)
      // Run first search so venues load for the visible area; map overlay clears after paint
      if (performSearchRef.current) {
        performSearchRef.current("", bounds, filtersRef.current, false, true)
      }
    },
    []
  )

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
          filters.favoritesOnly ||
          filters.availableNow
        if (!hasActive) {
          setIsSearchingText(false)
          if (currentBoundsRef.current) {
            await performSearch("", currentBoundsRef.current)
          } else {
            setVenues([])
            setMapRefreshTrigger(prev => prev + 1)
          }
          return
        }
      }
      // Text search = full DB; don't send bounds
      await performSearch(query, undefined)
    },
    [filters]
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
    
    // Filter apply = full DB; don't send bounds
    await performSearch(searchQuery, undefined, filtersToUse)
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
      favoritesOnly: false,
    }
    setFilters(cleared)
    setSearchQuery("") // Also clear search query
    // Force map refresh when clearing filters
    setMapRefreshTrigger(prev => prev + 1)
    // Save cleared filters to localStorage
    saveFiltersToStorage("", cleared)
    // Clear = full DB; don't send bounds
    await performSearch("", undefined, cleared)
  }, [searchQuery])

  const activeFilterCount =
    filters.tags.length +
    (filters.priceMin != null ? 1 : 0) +
    (filters.priceMax != null ? 1 : 0) +
    (filters.availableNow ? 1 : 0) +
    (filters.seatCount != null ? 1 : 0) +
    filters.bookingMode.length +
    (filters.dealsOnly ? 1 : 0) +
    (filters.favoritesOnly ? 1 : 0)

  // Generate individual filter chips
  const getFilterChips = () => {
    const chips: Array<{ id: string; label: string; onRemove: () => void }> = []
    
    if (filters.favoritesOnly) {
      chips.push({
        id: "favoritesOnly",
        label: "Favorites",
        onRemove: async () => {
          const newFilters = { ...filters, favoritesOnly: false }
          setFilters(newFilters)
          filtersRef.current = newFilters
          setMapRefreshTrigger(prev => prev + 1)
          await performSearch(searchQuery, undefined, newFilters)
        }
      })
    }
    
    if (filters.dealsOnly) {
      chips.push({
        id: "dealsOnly",
        label: "Venues with deals",
        onRemove: async () => {
          const newFilters = { ...filters, dealsOnly: false }
          setFilters(newFilters)
          filtersRef.current = newFilters
          setMapRefreshTrigger(prev => prev + 1)
          await performSearch(searchQuery, undefined, newFilters)
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
          await performSearch(searchQuery, undefined, newFilters)
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
          await performSearch(searchQuery, undefined, newFilters)
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
          await performSearch(searchQuery, undefined, newFilters)
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
          await performSearch(searchQuery, undefined, newFilters)
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
          await performSearch(searchQuery, undefined, newFilters)
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
          await performSearch(searchQuery, undefined, newFilters)
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

  // Brief loading overlay when venue card is clicked (until preview sheet animates in)
  useEffect(() => {
    if (selectedVenueId) {
      setVenueLoadingOverlay(true)
      const t = setTimeout(() => setVenueLoadingOverlay(false), 250)
      return () => clearTimeout(t)
    } else {
      setVenueLoadingOverlay(false)
    }
  }, [selectedVenueId])

  useEffect(() => {
    if (!centerOnVenueId) return
    const t = setTimeout(() => setCenterOnVenueId(null), 800)
    return () => clearTimeout(t)
  }, [centerOnVenueId])

  return (
    <div className="fixed inset-0 flex flex-col">
      {venueLoadingOverlay && (
        <LoadingOverlay zIndex={40} className="pointer-events-none" />
      )}
      {isClient && !mapReady && (
        <div className="fixed inset-0 z-0 flex items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">Loading map…</p>
        </div>
      )}
      {isClient && mapReady && (
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
            onBoundsChange={setDebugBounds}
            onInitialBounds={handleInitialBounds}
            didAreaSearch={didAreaSearchRef.current}
            initialLoadingComplete={venues.length > 0}
          />
          {process.env.NODE_ENV !== "production" && (
            <div className="fixed bottom-20 left-2 z-10 rounded bg-background/90 px-2 py-1 text-xs font-mono text-muted-foreground shadow">
              bounds:{" "}
              {debugBounds
                ? `${debugBounds.north.toFixed(4)}/${debugBounds.south.toFixed(4)}/${debugBounds.east.toFixed(4)}/${debugBounds.west.toFixed(4)}`
                : "—"}{" "}
              | results: {venues.length}
            </div>
          )}
          <div className="fixed left-0 right-0 top-0 z-10 flex flex-col gap-2">
            <ExploreWelcomeBanner
              onUseLocation={requestLocation}
              locationState={locationState}
            />
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
            isSearchingText={isSearchingText}
            onSelectVenue={(id) => setSelectedVenueId(id)}
            onCenterOnVenue={handleCenterOnVenue}
            autoExpand={!isSearchingArea && searchQuery.length > 0}
            favoritesOnly={filters.favoritesOnly}
            favoritedVenueIds={favoritedVenueIdsState}
            onToggleFavorite={async (venueId, favorited) => {
              // Update favorite state
              setFavoritedVenueIdsState(prev => {
                const newSet = new Set(prev)
                if (favorited) {
                  newSet.add(venueId)
                } else {
                  newSet.delete(venueId)
                }
                return newSet
              })
              
              // If favoritesOnly filter is active and venue was unfavorited, remove it from list
              if (filters.favoritesOnly && !favorited) {
                setVenues(prev => prev.filter(v => v.id !== venueId))
                // Refresh search to sync with server
                await performSearch(searchQuery, undefined, filters)
              }
            }}
            onClearFavoritesFilter={async () => {
              const newFilters = { ...filters, favoritesOnly: false }
              setFilters(newFilters)
              filtersRef.current = newFilters
              setMapRefreshTrigger(prev => prev + 1)
              await performSearch(searchQuery, undefined, newFilters)
            }}
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
            isFavorited={selectedVenue ? favoritedVenueIdsState.has(selectedVenue.id) : false}
            onToggleFavorite={async () => {
              // Optimistically update favorite state
              if (selectedVenue) {
                const wasFavorited = favoritedVenueIdsState.has(selectedVenue.id)
                setFavoritedVenueIdsState(prev => {
                  const newSet = new Set(prev)
                  if (wasFavorited) {
                    newSet.delete(selectedVenue.id)
                  } else {
                    newSet.add(selectedVenue.id)
                  }
                  return newSet
                })
                
                // If favoritesOnly filter is active and venue was unfavorited, refresh search
                if (filters.favoritesOnly && wasFavorited) {
                  // Remove venue from list immediately
                  setVenues(prev => prev.filter(v => v.id !== selectedVenue.id))
                  // Refresh search to get updated results
                  await performSearch(searchQuery, undefined, filters)
                }
              }
            }}
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
