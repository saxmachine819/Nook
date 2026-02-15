import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestVenue, createTestTable, createTestSeat, createTestVenueHoursRow } from "../helpers/test-utils";
import type { WeeklyHoursRow, CanonicalVenueHours } from "@/lib/hours";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    venue: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    venueHours: {
      findMany: vi.fn(),
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

const { batchGetCanonicalVenueHours, getOpenStatus } = await import("@/lib/hours");

describe("Venue Open Status Consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Status Enum Values", () => {
    it("returns OPEN_NOW when venue is within hours", () => {
      const venueHours: WeeklyHoursRow[] = [
        { dayOfWeek: 1, isClosed: false, openTime: "00:00", closeTime: "23:59" },
      ];

      const canonical: CanonicalVenueHours = {
        timezone: "America/New_York",
        weeklyHours: venueHours,
      };

      const mondayNoon = new Date("2025-02-03T17:00:00.000Z"); // 12 PM NYC
      const status = getOpenStatus(canonical, mondayNoon);

      expect(status.isOpen).toBe(true);
      expect(status.status).toBe("OPEN_NOW");
    });

    it("returns CLOSED_NOW when venue is after hours", () => {
      const venueHours: WeeklyHoursRow[] = [
        { dayOfWeek: 1, isClosed: false, openTime: "09:00", closeTime: "17:00" },
      ];

      const canonical: CanonicalVenueHours = {
        timezone: "America/New_York",
        weeklyHours: venueHours,
      };

      const monday8pm = new Date("2025-02-04T01:00:00.000Z"); // 8 PM NYC
      const status = getOpenStatus(canonical, monday8pm);

      expect(status.isOpen).toBe(false);
      expect(status.status).toBe("CLOSED_NOW");
    });

    it("returns OPENS_LATER when venue hasn't opened yet", () => {
      const venueHours: WeeklyHoursRow[] = [
        { dayOfWeek: 1, isClosed: false, openTime: "09:00", closeTime: "17:00" },
      ];

      const canonical: CanonicalVenueHours = {
        timezone: "America/New_York",
        weeklyHours: venueHours,
      };

      const monday7am = new Date("2025-02-03T12:00:00.000Z"); // 7 AM NYC
      const status = getOpenStatus(canonical, monday7am);

      expect(status.isOpen).toBe(false);
      expect(status.status).toBe("OPENS_LATER");
    });

    it("returns CLOSED_TODAY when venue is closed all day", () => {
      const venueHours: WeeklyHoursRow[] = [
        { dayOfWeek: 1, isClosed: true, openTime: null, closeTime: null },
      ];

      const canonical: CanonicalVenueHours = {
        timezone: "America/New_York",
        weeklyHours: venueHours,
      };

      const mondayNoon = new Date("2025-02-03T17:00:00.000Z");
      const status = getOpenStatus(canonical, mondayNoon);

      expect(status.isOpen).toBe(false);
      expect(status.status).toBe("CLOSED_TODAY");
    });
  });

  describe("Cross-Day Scenarios", () => {
    it("handles late night hours correctly", () => {
      // Venue open until 2 AM
      const venueHours: WeeklyHoursRow[] = [
        { dayOfWeek: 1, isClosed: false, openTime: "18:00", closeTime: "23:59" },
        { dayOfWeek: 2, isClosed: false, openTime: "00:00", closeTime: "02:00" },
      ];

      const canonical: CanonicalVenueHours = {
        timezone: "America/New_York",
        weeklyHours: venueHours,
      };

      // Monday 11 PM NYC (Tuesday 4 AM UTC)
      const monday11pm = new Date("2025-02-04T04:00:00.000Z");
      const status = getOpenStatus(canonical, monday11pm);

      expect(status.isOpen).toBe(true);
      expect(status.status).toBe("OPEN_NOW");
    });

    it("handles early morning opening", () => {
      const venueHours: WeeklyHoursRow[] = [
        { dayOfWeek: 1, isClosed: false, openTime: "06:00", closeTime: "22:00" },
      ];

      const canonical: CanonicalVenueHours = {
        timezone: "America/New_York",
        weeklyHours: venueHours,
      };

      // Monday 7 AM NYC
      const monday7am = new Date("2025-02-03T12:00:00.000Z");
      const status = getOpenStatus(canonical, monday7am);

      expect(status.isOpen).toBe(true);
      expect(status.status).toBe("OPEN_NOW");
    });
  });

  describe("24-Hour Venues", () => {
    it("correctly identifies 24-hour venues as always open", () => {
      const venueHours: WeeklyHoursRow[] = [
        { dayOfWeek: 1, isClosed: false, openTime: "00:00", closeTime: "23:59" },
      ];

      const canonical: CanonicalVenueHours = {
        timezone: "America/New_York",
        weeklyHours: venueHours,
      };

      const times = [
        new Date("2025-02-03T05:00:00.000Z"), // 12 AM NYC
        new Date("2025-02-03T12:00:00.000Z"), // 7 AM NYC
        new Date("2025-02-03T17:00:00.000Z"), // 12 PM NYC
        new Date("2025-02-03T22:00:00.000Z"), // 5 PM NYC
        new Date("2025-02-04T03:00:00.000Z"), // 10 PM NYC
      ];

      times.forEach((time) => {
        const status = getOpenStatus(canonical, time);
        expect(status.isOpen).toBe(true);
        expect(status.status).toBe("OPEN_NOW");
      });
    });
  });

  describe("Timezone Edge Cases", () => {
    it("handles DST transitions correctly", () => {
      // During DST, NYC is UTC-4, otherwise UTC-5
      const venueHours: WeeklyHoursRow[] = [
        { dayOfWeek: 1, isClosed: false, openTime: "09:00", closeTime: "17:00" },
      ];

      const canonical: CanonicalVenueHours = {
        timezone: "America/New_York",
        weeklyHours: venueHours,
      };

      // Standard time (winter): 9 AM NYC = 2 PM UTC
      const winterMonday = new Date("2025-02-03T14:00:00.000Z");
      const winterStatus = getOpenStatus(canonical, winterMonday);
      expect(winterStatus.isOpen).toBe(true);

      // Daylight time (summer): 9 AM NYC = 1 PM UTC  
      const summerMonday = new Date("2025-07-07T13:00:00.000Z");
      const summerStatus = getOpenStatus(canonical, summerMonday);
      expect(summerStatus.isOpen).toBe(true);
    });

    it("handles different timezones", () => {
      const venueHours: WeeklyHoursRow[] = [
        { dayOfWeek: 1, isClosed: false, openTime: "09:00", closeTime: "17:00" },
      ];

      // LA timezone (UTC-8 in winter, UTC-7 in summer)
      const canonicalLA: CanonicalVenueHours = {
        timezone: "America/Los_Angeles",
        weeklyHours: venueHours,
      };

      // 9 AM LA = 5 PM UTC in winter
      const laMonday = new Date("2025-02-03T17:00:00.000Z");
      const laStatus = getOpenStatus(canonicalLA, laMonday);
      expect(laStatus.isOpen).toBe(true);
      expect(laStatus.todayHoursText).toMatch(/9:00/);
    });
  });

  describe("nextOpenAt Calculation", () => {
    it("returns next open time for CLOSED_NOW status", () => {
      const venueHours: WeeklyHoursRow[] = [
        { dayOfWeek: 1, isClosed: false, openTime: "09:00", closeTime: "17:00" },
        { dayOfWeek: 2, isClosed: false, openTime: "09:00", closeTime: "17:00" },
      ];

      const canonical: CanonicalVenueHours = {
        timezone: "America/New_York",
        weeklyHours: venueHours,
      };

      // Monday 8 PM NYC (after close)
      const monday8pm = new Date("2025-02-04T01:00:00.000Z");
      const status = getOpenStatus(canonical, monday8pm);

      expect(status.isOpen).toBe(false);
      expect(status.status).toBe("CLOSED_NOW");
      expect(status.nextOpenAt).toBeDefined();
    });

    it("returns next open time for OPENS_LATER status", () => {
      const venueHours: WeeklyHoursRow[] = [
        { dayOfWeek: 1, isClosed: false, openTime: "09:00", closeTime: "17:00" },
      ];

      const canonical: CanonicalVenueHours = {
        timezone: "America/New_York",
        weeklyHours: venueHours,
      };

      // Monday 7 AM NYC (before open)
      const monday7am = new Date("2025-02-03T12:00:00.000Z");
      const status = getOpenStatus(canonical, monday7am);

      expect(status.isOpen).toBe(false);
      expect(status.status).toBe("OPENS_LATER");
      expect(status.nextOpenAt).toBeDefined();
    });
  });
});
