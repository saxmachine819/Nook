/**
 * Shared venue type definitions used across API routes and frontend hooks.
 * These types define the response shapes for the optimized venue endpoints.
 */

/** Open status enum matching the hours engine output */
export type OpenStatusValue = "OPEN_NOW" | "CLOSED_NOW" | "OPENS_LATER" | "CLOSED_TODAY"

/** Minimal open status for display */
export interface VenueOpenStatus {
  status: OpenStatusValue
  todayHoursText: string
}

/** Deal badge information for venue cards */
export interface VenueDealBadge {
  title: string
  description: string
  type: string
  summary: string
}

/**
 * Lightweight venue data for map pins (~150 bytes per venue).
 * Used by the /api/venues/pins endpoint for rendering map markers.
 */
export interface VenuePin {
  id: string
  name: string
  latitude: number
  longitude: number
  minPrice: number
  openStatus: OpenStatusValue | null
}

/**
 * Medium-weight venue data for listing cards (~2KB per venue).
 * Used by the /api/venues/cards endpoint for rendering venue cards.
 */
export interface VenueCard {
  id: string
  name: string
  address: string
  city?: string
  state?: string
  latitude: number
  longitude: number
  minPrice: number
  maxPrice: number
  tags: string[]
  imageUrl: string | null
  imageUrls: string[]
  availabilityLabel: string
  openStatus: VenueOpenStatus | null
  dealBadge: VenueDealBadge | null
}

/**
 * Full venue data for detail views and the existing search endpoint.
 * Extends VenueCard with additional fields needed for detailed display.
 */
export interface VenueDetail extends VenueCard {
  neighborhood?: string
  capacity: number
  rulesText?: string
  imageUrls: string[]
  hourlySeatPrice: number
}

/** Search filters for venue queries */
export interface VenueSearchFilters {
  q?: string
  tags?: string[]
  priceMin?: number
  priceMax?: number
  seatCount?: number
  bookingMode?: ("communal" | "full-table")[]
  dealsOnly?: boolean
  favoritesOnly?: boolean
  availableNow?: boolean
}

/** Map bounds for geographic filtering */
export interface MapBounds {
  north: number
  south: number
  east: number
  west: number
}

/** Response shape for /api/venues/pins */
export interface VenuePinsResponse {
  pins: VenuePin[]
}

/** Response shape for /api/venues/cards */
export interface VenueCardsResponse {
  venues: VenueCard[]
  favoritedVenueIds: string[]
}

/** Response shape for /api/venues/search (existing endpoint) */
export interface VenueSearchResponse {
  venues: VenueDetail[]
  favoritedVenueIds: string[]
}
