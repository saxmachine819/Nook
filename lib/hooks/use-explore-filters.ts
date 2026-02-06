"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import type { FilterState } from "@/components/explore/FilterPanel"
import { DEFAULT_FILTERS, getActiveFilterCount } from "@/lib/explore-utils"

const FILTER_STORAGE_KEY = "nooc_explore_filters"

interface StoredFilters {
  searchQuery: string
  filters: FilterState
}

function loadFiltersFromStorage(): StoredFilters {
  if (typeof window === "undefined") {
    return { searchQuery: "", filters: DEFAULT_FILTERS }
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

  return { searchQuery: "", filters: DEFAULT_FILTERS }
}

function saveFiltersToStorage(searchQuery: string, filters: FilterState) {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({ searchQuery, filters }))
  } catch (e) {
    console.error("Error saving filters to localStorage:", e)
  }
}

export interface FilterChip {
  id: string
  label: string
  onRemove: () => void
}

export interface InitialFilters {
  searchQuery: string
  filters: FilterState
}

export function useExploreFilters(initialFilters?: InitialFilters) {
  const storageState = loadFiltersFromStorage()
  const initialState = initialFilters ?? storageState
  const [searchQuery, setSearchQuery] = useState(initialState.searchQuery)
  const [filters, setFilters] = useState<FilterState>(initialState.filters)
  const filtersRef = useRef<FilterState>(initialState.filters)

  useEffect(() => {
    filtersRef.current = filters
    saveFiltersToStorage(searchQuery, filters)
  }, [filters, searchQuery])

  const activeFilterCount = useMemo(() => getActiveFilterCount(filters), [filters])

  const updateFilter = useCallback((partial: Partial<FilterState>) => {
    setFilters((prev) => {
      const updated = { ...prev, ...partial }
      filtersRef.current = updated
      return updated
    })
  }, [])

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
    setSearchQuery("")
    saveFiltersToStorage("", DEFAULT_FILTERS)
  }, [])

  const filterChips = useMemo((): FilterChip[] => {
    const chips: FilterChip[] = []

    if (filters.favoritesOnly) {
      chips.push({
        id: "favoritesOnly",
        label: "Favorites",
        onRemove: () => updateFilter({ favoritesOnly: false }),
      })
    }

    if (filters.dealsOnly) {
      chips.push({
        id: "dealsOnly",
        label: "Venues with deals",
        onRemove: () => updateFilter({ dealsOnly: false }),
      })
    }

    filters.tags.forEach((tag) => {
      chips.push({
        id: `tag-${tag}`,
        label: tag,
        onRemove: () => updateFilter({ tags: filters.tags.filter((t) => t !== tag) }),
      })
    })

    if (filters.priceMin != null) {
      chips.push({
        id: "priceMin",
        label: `Min: $${filters.priceMin}`,
        onRemove: () => updateFilter({ priceMin: null }),
      })
    }

    if (filters.priceMax != null) {
      chips.push({
        id: "priceMax",
        label: `Max: $${filters.priceMax}`,
        onRemove: () => updateFilter({ priceMax: null }),
      })
    }

    if (filters.seatCount != null) {
      chips.push({
        id: "seatCount",
        label: `${filters.seatCount}+ seats`,
        onRemove: () => updateFilter({ seatCount: null }),
      })
    }

    filters.bookingMode.forEach((mode) => {
      chips.push({
        id: `bookingMode-${mode}`,
        label: mode === "communal" ? "Communal" : "Full table",
        onRemove: () => updateFilter({ bookingMode: filters.bookingMode.filter((m) => m !== mode) }),
      })
    })

    if (filters.availableNow) {
      chips.push({
        id: "availableNow",
        label: "Available now",
        onRemove: () => updateFilter({ availableNow: false }),
      })
    }

    return chips
  }, [filters, updateFilter])

  return {
    filters,
    setFilters,
    filtersRef,
    searchQuery,
    setSearchQuery,
    activeFilterCount,
    filterChips,
    updateFilter,
    clearFilters,
  }
}
