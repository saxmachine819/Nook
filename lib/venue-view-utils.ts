/**
 * Shared utility functions for calculating venue-level metrics like capacity and price range.
 * This ensures consistency across search, cards, pins, and availability APIs.
 */

export interface PriceRange {
  minPrice: number;
  maxPrice: number;
}

/**
 * Calculate the total reservable capacity of a venue.
 * Accounts for active tables and active seats.
 */
export function calculateVenueCapacity(venue: any): number {
  if (!venue.tables || !Array.isArray(venue.tables)) return 0;

  return venue.tables.reduce((sum: number, table: any) => {
    // Only count active tables
    if (table.isActive === false) return sum;

    // Prefer seat-level records if they exist and are active
    if (table.seats && Array.isArray(table.seats) && table.seats.length > 0) {
      const activeSeats = table.seats.filter((s: any) => s.isActive !== false);
      if (activeSeats.length > 0) {
        return sum + activeSeats.length;
      }
    }

    // Fallback to table-level seat count for venues without individual seat records
    return sum + (table.seatCount || 0);
  }, 0);
}

/**
 * Calculate the price range (min/max) for a venue across all booking modes.
 */
export function calculateVenuePriceRange(venue: any): PriceRange {
  if (!venue.tables || !Array.isArray(venue.tables)) {
    const fallback = venue.hourlySeatPrice > 0 ? venue.hourlySeatPrice : 0;
    return { minPrice: fallback, maxPrice: fallback };
  }

  // 1. Get all individual seat prices from individual booking tables
  const allSeatPrices = venue.tables
    .filter((t: any) => t.isActive !== false && t.bookingMode !== "group")
    .flatMap((t: any) =>
      (t.seats || [])
        .filter(
          (s: any) =>
            s.isActive !== false &&
            s.pricePerHour != null &&
            s.pricePerHour > 0,
        )
        .map((s: any) => s.pricePerHour),
    );

  // 2. Get all table-level prices from group booking tables
  const allTablePrices = venue.tables
    .filter(
      (t: any) =>
        t.isActive !== false &&
        t.bookingMode === "group" &&
        t.tablePricePerHour != null &&
        t.tablePricePerHour > 0,
    )
    .map((t: any) => t.tablePricePerHour);

  const candidatePrices = [...allSeatPrices, ...allTablePrices];
  const fallback = venue.hourlySeatPrice > 0 ? venue.hourlySeatPrice : 0;

  if (candidatePrices.length === 0) {
    return { minPrice: fallback, maxPrice: fallback };
  }

  return {
    minPrice: Math.min(...candidatePrices),
    maxPrice: Math.max(...candidatePrices),
  };
}
