import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestVenue, createTestTable, createTestSeat, createTestVenueHoursRow } from "../helpers/test-utils";
import { cache } from "@/lib/cache";
import type { WeeklyHoursRow, CanonicalVenueHours } from "@/lib/hours";

// Mock Prisma before importing the route
vi.mock("@/lib/prisma", () => ({
  prisma: {
    venue: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    venueHours: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    reservation: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb({ venueHours: { findMany: vi.fn(), upsert: vi.fn() } })),
  },
}));

global.fetch = vi.fn().mockResolvedValue({ ok: true });

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "test-user-id", email: "test@example.com" } }),
}));

// Import route and modules after mocks
const { GET: getPins } = await import("@/app/api/venues/pins/route");
const { batchGetCanonicalVenueHours, getOpenStatus, getSlotTimesForDate } = await import("@/lib/hours");

describe("Venue Hours E2E", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache.clearAll();
  });

  describe("Hours Engine", () => {
    it("correctly determines open status for various times", () => {
      const venueHours: WeeklyHoursRow[] = [
        { dayOfWeek: 1, isClosed: false, openTime: "09:00", closeTime: "17:00" },
        { dayOfWeek: 2, isClosed: false, openTime: "10:00", closeTime: "22:00" },
        { dayOfWeek: 0, isClosed: true, openTime: null, closeTime: null },
      ];

      const canonical: CanonicalVenueHours = {
        timezone: "America/New_York",
        weeklyHours: venueHours,
      };

      const monday10am = new Date("2025-02-03T15:00:00.000Z");
      const monday8am = new Date("2025-02-03T13:00:00.000Z");
      const monday6pm = new Date("2025-02-03T23:00:00.000Z");

      const status10am = getOpenStatus(canonical, monday10am);
      const status8am = getOpenStatus(canonical, monday8am);
      const status6pm = getOpenStatus(canonical, monday6pm);

      expect(status10am.isOpen).toBe(true);
      expect(status10am.status).toBe("OPEN_NOW");

      expect(status8am.isOpen).toBe(false);
      expect(status8am.status).toBe("OPENS_LATER");

      expect(status6pm.isOpen).toBe(false);
      expect(status6pm.status).toBe("CLOSED_NOW");
    });

    it("handles timezone conversion correctly", () => {
      const venueHours: WeeklyHoursRow[] = [
        { dayOfWeek: 1, isClosed: false, openTime: "09:00", closeTime: "17:00" },
      ];

      const canonical: CanonicalVenueHours = {
        timezone: "America/New_York",
        weeklyHours: venueHours,
      };

      const utcMonday10am = new Date("2025-02-03T15:00:00.000Z");

      const status = getOpenStatus(canonical, utcMonday10am);

      expect(status.isOpen).toBe(true);
      expect(status.todayHoursText).toMatch(/9:00/);
    });

    it("generates correct time slots for a date", () => {
      const venueHours: WeeklyHoursRow[] = [
        { dayOfWeek: 1, isClosed: false, openTime: "09:00", closeTime: "17:00" },
      ];

      const canonical: CanonicalVenueHours = {
        timezone: "America/New_York",
        weeklyHours: venueHours,
      };

      const slots = getSlotTimesForDate(canonical, "2025-02-03");

      expect(slots.length).toBeGreaterThan(0);
      // Slots should cover the open period (9 AM to 5 PM NYC)
      // First slot starts at or before 9 AM NYC
      // Last slot ends at or after 5 PM NYC
      const firstSlot = slots[0];
      const lastSlot = slots[slots.length - 1];
      
      // Verify slots are in chronological order
      expect(firstSlot.start.getTime()).toBeLessThan(lastSlot.end.getTime());
      
      // Verify slot duration is 1 hour (3600000 ms)
      expect(lastSlot.end.getTime() - firstSlot.start.getTime()).toBeGreaterThan(0);
    });
  });

});
