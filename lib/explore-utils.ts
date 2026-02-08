import type { FilterState } from "@/components/explore/FilterPanel"
import type { VenueCard, VenueSearchFilters } from "@/types/venue"

export interface ExploreVenue {
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

export function venueCardToExploreVenue(card: VenueCard): ExploreVenue {
  return {
    id: card.id,
    name: card.name,
    address: card.address,
    city: card.city,
    state: card.state,
    latitude: card.latitude,
    longitude: card.longitude,
    minPrice: card.minPrice,
    maxPrice: card.maxPrice,
    tags: card.tags,
    capacity: 0,
    availabilityLabel: card.availabilityLabel,
    openStatus: card.openStatus,
    imageUrls:
      card.imageUrls?.length > 0
        ? card.imageUrls
        : card.imageUrl
          ? [card.imageUrl]
          : undefined,
    hourlySeatPrice: card.minPrice,
    dealBadge: card.dealBadge,
  }
}

export function filterStateToSearchFilters(filters: FilterState): VenueSearchFilters {
  return {
    tags: filters.tags.length > 0 ? filters.tags : undefined,
    priceMin: filters.priceMin ?? undefined,
    priceMax: filters.priceMax ?? undefined,
    seatCount: filters.seatCount ?? undefined,
    bookingMode: filters.bookingMode.length > 0 ? filters.bookingMode : undefined,
    dealsOnly: filters.dealsOnly || undefined,
    favoritesOnly: filters.favoritesOnly || undefined,
    availableNow: filters.availableNow || undefined,
  }
}

export function hasActiveFilters(filters: FilterState): boolean {
  return (
    filters.tags.length > 0 ||
    filters.priceMin != null ||
    filters.priceMax != null ||
    filters.seatCount != null ||
    filters.bookingMode.length > 0 ||
    filters.dealsOnly ||
    filters.favoritesOnly ||
    filters.availableNow
  )
}

export function getActiveFilterCount(filters: FilterState): number {
  return (
    filters.tags.length +
    (filters.priceMin != null ? 1 : 0) +
    (filters.priceMax != null ? 1 : 0) +
    (filters.availableNow ? 1 : 0) +
    (filters.seatCount != null ? 1 : 0) +
    filters.bookingMode.length +
    (filters.dealsOnly ? 1 : 0) +
    (filters.favoritesOnly ? 1 : 0)
  )
}

export const DEFAULT_FILTERS: FilterState = {
  tags: [],
  priceMin: null,
  priceMax: null,
  availableNow: false,
  seatCount: null,
  bookingMode: [],
  dealsOnly: false,
  favoritesOnly: false,
}
