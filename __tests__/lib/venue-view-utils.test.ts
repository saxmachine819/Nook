import { describe, it, expect } from "vitest";
import {
  calculateVenueCapacity,
  calculateVenuePriceRange,
} from "@/lib/venue-view-utils";

describe("venue-view-utils", () => {
  describe("calculateVenueCapacity", () => {
    it("returns 0 for venue with no tables", () => {
      expect(calculateVenueCapacity({})).toBe(0);
    });

    it("calculates capacity using seatCount fallback", () => {
      const venue = {
        tables: [
          { isActive: true, seatCount: 4 },
          { isActive: true, seatCount: 2 },
          { isActive: false, seatCount: 10 }, // Inactive table should be ignored
        ],
      };
      expect(calculateVenueCapacity(venue)).toBe(6);
    });

    it("prefers active seats over seatCount", () => {
      const venue = {
        tables: [
          {
            isActive: true,
            seatCount: 4,
            seats: [
              { isActive: true },
              { isActive: true },
              { isActive: false }, // Inactive seat
            ],
          },
        ],
      };
      expect(calculateVenueCapacity(venue)).toBe(2);
    });

    it("handles mixed table types", () => {
      const venue = {
        tables: [
          {
            isActive: true,
            seatCount: 10,
            seats: [{ isActive: true }, { isActive: true }],
          },
          {
            isActive: true,
            seatCount: 5,
            seats: [],
          },
        ],
      };
      expect(calculateVenueCapacity(venue)).toBe(7);
    });
  });

  describe("calculateVenuePriceRange", () => {
    it("returns fallback for venue with no tables", () => {
      const venue = { hourlySeatPrice: 15 };
      expect(calculateVenuePriceRange(venue)).toEqual({
        minPrice: 15,
        maxPrice: 15,
      });
    });

    it("calculates price range from individual seats and group tables", () => {
      const venue = {
        tables: [
          {
            isActive: true,
            bookingMode: "individual",
            seats: [
              { isActive: true, pricePerHour: 10 },
              { isActive: true, pricePerHour: 20 },
            ],
          },
          {
            isActive: true,
            bookingMode: "group",
            tablePricePerHour: 50,
          },
          {
            isActive: false, // Inactive table
            bookingMode: "group",
            tablePricePerHour: 5,
          },
        ],
      };
      expect(calculateVenuePriceRange(venue)).toEqual({
        minPrice: 10,
        maxPrice: 50,
      });
    });

    it("ignores inactive seats and invalid prices", () => {
      const venue = {
        hourlySeatPrice: 15,
        tables: [
          {
            isActive: true,
            bookingMode: "individual",
            seats: [
              { isActive: false, pricePerHour: 5 },
              { isActive: true, pricePerHour: 0 },
              { isActive: true, pricePerHour: 25 },
            ],
          },
        ],
      };
      expect(calculateVenuePriceRange(venue)).toEqual({
        minPrice: 25,
        maxPrice: 25,
      });
    });
  });
});
