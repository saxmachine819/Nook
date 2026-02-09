import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getLocalDateString,
  computeAvailabilityLabel,
} from "@/lib/availability-utils";
import type { OpenStatus } from "@/lib/hours";

describe("availability-utils", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const now = new Date("2024-01-22T12:00:00Z"); // Monday
    vi.setSystemTime(now);
  });

  describe("getLocalDateString", () => {
    it("returns correct YYYY-MM-DD for a Date object in UTC", () => {
      const date = new Date("2024-01-22T05:00:00Z"); // Jan 22
      expect(getLocalDateString(date, "UTC")).toBe("2024-01-22");
    });

    it("returns correct YYYY-MM-DD for a timezone that shifts the date forward", () => {
      const date = new Date("2024-01-22T22:00:00Z");
      // In Tokyo (UTC+9), this is Jan 23 07:00
      expect(getLocalDateString(date, "Asia/Tokyo")).toBe("2024-01-23");
    });

    it("returns correct YYYY-MM-DD for a timezone that shifts the date backward", () => {
      const date = new Date("2024-01-22T02:00:00Z");
      // In New York (UTC-5), this is Jan 21 21:00
      expect(getLocalDateString(date, "America/New_York")).toBe("2024-01-21");
    });
  });

  describe("computeAvailabilityLabel", () => {
    const defaultOpenStatus: OpenStatus = {
      isOpen: true,
      status: "OPEN_NOW",
      todayLabel: "Today",
      todayHoursText: "9:00 AM – 5:00 PM",
    };

    it("returns 'Sold out for now' when capacity is 0", () => {
      expect(computeAvailabilityLabel(0, [], defaultOpenStatus)).toBe(
        "Sold out for now",
      );
    });

    it("returns 'Currently Closed' when openStatus is null", () => {
      expect(computeAvailabilityLabel(10, [], null)).toBe("Currently Closed");
    });

    it("returns 'Currently Closed' when venue is closed and no nextOpenAt", () => {
      const closedStatus: OpenStatus = {
        ...defaultOpenStatus,
        isOpen: false,
        status: "CLOSED_NOW",
      };
      expect(computeAvailabilityLabel(10, [], closedStatus)).toBe(
        "Currently Closed",
      );
    });

    it("returns 'Opens at ...' when opens later today", () => {
      const nextOpen = new Date("2024-01-22T14:00:00Z");
      const closedStatus: OpenStatus = {
        ...defaultOpenStatus,
        isOpen: false,
        status: "OPENS_LATER",
        nextOpenAt: nextOpen,
      };
      expect(
        computeAvailabilityLabel(10, [], closedStatus, { timeZone: "UTC" }),
      ).toMatch(/Opens at 2:00 PM/);
    });

    it("returns 'Opens tomorrow at ...' when opens tomorrow", () => {
      const nextOpen = new Date("2024-01-23T09:00:00Z");
      const closedStatus: OpenStatus = {
        ...defaultOpenStatus,
        isOpen: false,
        status: "CLOSED_NOW",
        nextOpenAt: nextOpen,
      };
      expect(
        computeAvailabilityLabel(10, [], closedStatus, { timeZone: "UTC" }),
      ).toMatch(/Opens tomorrow at 9:00 AM/);
    });

    it("returns 'Opens {Day} at ...' when opens further in future", () => {
      const nextOpen = new Date("2024-01-25T09:00:00Z"); // Thursday
      const closedStatus: OpenStatus = {
        ...defaultOpenStatus,
        isOpen: false,
        status: "CLOSED_NOW",
        nextOpenAt: nextOpen,
      };
      expect(
        computeAvailabilityLabel(10, [], closedStatus, { timeZone: "UTC" }),
      ).toMatch(/Opens Thursday at 9:00 AM/);
    });

    it("returns 'Available now' when open and under capacity", () => {
      expect(computeAvailabilityLabel(10, [], defaultOpenStatus)).toBe(
        "Available now",
      );
    });

    it("returns 'Next availability @ ...' when fully booked now but free later", () => {
      const now = new Date("2024-01-22T12:00:00Z");
      // Round up to next 15 min: 12:00 -> 12:00 (since it's exactly on boundary)
      // Actually roundUpToNext15Minutes has a check for boundary.

      const reservations = [
        {
          startAt: new Date("2024-01-22T12:00:00Z"),
          endAt: new Date("2024-01-22T13:00:00Z"),
          seatCount: 10,
        },
      ];
      expect(
        computeAvailabilityLabel(10, reservations, defaultOpenStatus, {
          timeZone: "UTC",
        }),
      ).toBe("Next availability @ 1:00 PM");
    });
  });
});
