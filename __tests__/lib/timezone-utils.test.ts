import { describe, it, expect } from "vitest";
import {
  getInTimezone,
  convertToUtc,
  formatInTimezone,
  getDayOfWeek,
  isTimeWithinRange,
  parseHHMM,
  formatMinutesToDisplay,
  getDayBoundsInTimezone,
  getPartsInTimezone,
  dateAtTimeInTimezone,
  roundUpToNext15Minutes,
} from "@/lib/timezone-utils";
import dayjs from "dayjs";

describe("timezone-utils", () => {
  const NY_TZ = "America/New_York";
  const TOKYO_TZ = "Asia/Tokyo";

  describe("getInTimezone", () => {
    it("converts a Date to the specified timezone", () => {
      const date = new Date("2025-02-10T15:00:00Z");
      const d = getInTimezone(date, NY_TZ);
      expect(d.format("YYYY-MM-DD HH:mm")).toBe("2025-02-10 10:00");
    });

    it("converts a timestamp to the specified timezone", () => {
      const timestamp = new Date("2025-02-10T15:00:00Z").getTime();
      const d = getInTimezone(timestamp, TOKYO_TZ);
      expect(d.format("YYYY-MM-DD HH:mm")).toBe("2025-02-11 00:00");
    });
  });

  describe("convertToUtc", () => {
    it("converts a dayjs object to a UTC Date", () => {
      const d = dayjs.tz("2025-02-10 10:00", NY_TZ);
      const utcDate = convertToUtc(d);
      expect(utcDate.toISOString()).toBe("2025-02-10T15:00:00.000Z");
    });
  });

  describe("formatInTimezone", () => {
    it("formats a date in the specified timezone", () => {
      const date = new Date("2025-02-10T15:00:00Z");
      expect(formatInTimezone(date, NY_TZ, "h:mm A")).toBe("10:00 AM");
      expect(formatInTimezone(date, TOKYO_TZ, "YYYY-MM-DD")).toBe("2025-02-11");
    });
  });

  describe("getDayOfWeek", () => {
    it("returns the correct weekday for different timezones", () => {
      const date = new Date("2025-02-10T23:00:00Z"); // Monday night UTC
      expect(getDayOfWeek(date, NY_TZ)).toBe(1); // Still Monday in NY (18:00)
      expect(getDayOfWeek(date, TOKYO_TZ)).toBe(2); // Tuesday morning in Tokyo (08:00)
    });
  });

  describe("isTimeWithinRange", () => {
    it("returns true for time within range", () => {
      expect(isTimeWithinRange("10:00", "09:00", "17:00")).toBe(true);
      expect(isTimeWithinRange("09:00", "09:00", "17:00")).toBe(true);
    });

    it("returns false for time outside range", () => {
      expect(isTimeWithinRange("08:59", "09:00", "17:00")).toBe(false);
      expect(isTimeWithinRange("17:00", "09:00", "17:00")).toBe(false);
    });

    it("handles 23:59 as end of day", () => {
      // Bumping 23:59 to 24:00 in closeStr allows the 23:59 minute to be inclusive
      expect(isTimeWithinRange("23:59", "09:00", "23:59")).toBe(true);
      expect(isTimeWithinRange("23:58", "09:00", "23:59")).toBe(true);
    });
  });

  describe("parseHHMM", () => {
    it("parses valid HH:mm strings", () => {
      expect(parseHHMM("09:30")).toBe(570);
      expect(parseHHMM("00:00")).toBe(0);
      expect(parseHHMM("23:59")).toBe(1439);
      expect(parseHHMM("24:00")).toBe(1440);
    });

    it("returns null for invalid inputs", () => {
      expect(parseHHMM("invalid")).toBeNull();
      expect(parseHHMM("9:30")).toBe(570); // Should handle single digit hour
      expect(parseHHMM(null as any)).toBeNull();
    });
  });

  describe("formatMinutesToDisplay", () => {
    it("formats minutes since midnight correctly", () => {
      expect(formatMinutesToDisplay(570)).toBe("9:30 AM");
      expect(formatMinutesToDisplay(720)).toBe("12:00 PM");
      expect(formatMinutesToDisplay(0)).toBe("12:00 AM");
      expect(formatMinutesToDisplay(1439)).toBe("11:59 PM");
    });
  });

  describe("getDayBoundsInTimezone", () => {
    it("returns correct start and end of day", () => {
      const bounds = getDayBoundsInTimezone("2025-02-10", NY_TZ);
      expect(bounds.start.toISOString()).toBe("2025-02-10T05:00:00.000Z");
      expect(bounds.end.toISOString()).toBe("2025-02-11T04:59:59.999Z");
    });
  });

  describe("getPartsInTimezone", () => {
    it("returns all parts correctly", () => {
      const date = new Date("2025-02-10T15:30:00Z");
      const parts = getPartsInTimezone(date, NY_TZ);
      expect(parts.year).toBe(2025);
      expect(parts.month).toBe(2);
      expect(parts.day).toBe(10);
      expect(parts.hour).toBe(10);
      expect(parts.minute).toBe(30);
      expect(parts.dayOfWeek).toBe(1);
      expect(parts.todayLabel).toBe("Mon");
    });
  });

  describe("dateAtTimeInTimezone", () => {
    it("creates a Date at specific time in timezone", () => {
      const ref = new Date("2025-02-10T12:00:00Z");
      const result = dateAtTimeInTimezone(NY_TZ, ref, 9, 0);
      expect(result.toISOString()).toBe("2025-02-10T14:00:00.000Z");
    });
  });

  describe("roundUpToNext15Minutes", () => {
    it("rounds up to next 15m boundary", () => {
      const d1 = new Date("2025-02-10T10:07:00Z");
      expect(roundUpToNext15Minutes(d1).getUTCMinutes()).toBe(15);

      const d2 = new Date("2025-02-10T10:15:00Z");
      expect(roundUpToNext15Minutes(d2).getUTCMinutes()).toBe(15);

      const d3 = new Date("2025-02-10T10:15:01Z");
      expect(roundUpToNext15Minutes(d3).getUTCMinutes()).toBe(30);
    });

    it("handles end of hour and day rounding", () => {
      const d = new Date("2025-02-10T23:55:00Z");
      const result = roundUpToNext15Minutes(d);
      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCDate()).toBe(11);
    });
  });

  describe("DST transitions", () => {
    it("getDayBoundsInTimezone handles Spring Forward (23h day)", () => {
      // US Eastern Spring Forward 2025: March 9th
      const bounds = getDayBoundsInTimezone("2025-03-09", NY_TZ);
      // 2:00 AM -> 3:00 AM.
      // Day starts at 05:00 UTC (12 AM EST)
      // Day ends at 03:59:59.999 UTC next day (11:59 PM EDT)
      expect(bounds.start.toISOString()).toBe("2025-03-09T05:00:00.000Z");
      expect(bounds.end.toISOString()).toBe("2025-03-10T03:59:59.999Z");
    });

    it("getDayBoundsInTimezone handles Fall Back (25h day)", () => {
      // US Eastern Fall Back 2025: Nov 2nd
      const bounds = getDayBoundsInTimezone("2025-11-02", NY_TZ);
      // 2:00 AM -> 1:00 AM.
      // Day starts at 04:00 UTC (12 AM EDT)
      // Day ends at 04:59:59.999 UTC next day (11:59 PM EST)
      expect(bounds.start.toISOString()).toBe("2025-11-02T04:00:00.000Z");
      expect(bounds.end.toISOString()).toBe("2025-11-03T04:59:59.999Z");
    });

    it("dateAtTimeInTimezone handles non-existent time (Spring Forward gap)", () => {
      // 2:30 AM doesn't exist on March 9, 2025 in NY (Spring Forward at 2:00 AM)
      const ref = new Date("2025-03-09T10:00:00Z");
      const result = dateAtTimeInTimezone(NY_TZ, ref, 2, 30);
      // Dayjs advances past the non-existent time to the next valid time (3:30 AM)
      const parts = getPartsInTimezone(result, NY_TZ);
      expect(parts.hour).toBe(3);
      expect(parts.minute).toBe(30);
    });

    it("dateAtTimeInTimezone handles ambiguous time (Fall Back overlap)", () => {
      // 1:30 AM exists twice on Nov 2, 2025 in NY.
      const ref = new Date("2025-11-02T10:00:00Z");
      const result = dateAtTimeInTimezone(NY_TZ, ref, 1, 30);
      const parts = getPartsInTimezone(result, NY_TZ);
      expect(parts.hour).toBe(1);
      expect(parts.minute).toBe(30);
      // Usually defaults to the first instance (EDT) or second (EST).
    });
  });

  describe("Leap Year", () => {
    it("handles Feb 29 correctly", () => {
      const dateStr = "2024-02-29";
      const bounds = getDayBoundsInTimezone(dateStr, NY_TZ);
      expect(bounds.start.toISOString()).toBe("2024-02-29T05:00:00.000Z");

      const monParts = getPartsInTimezone(
        new Date("2024-02-29T12:00:00Z"),
        NY_TZ,
      );
      expect(monParts.month).toBe(2);
      expect(monParts.day).toBe(29);
    });
  });

  describe("Invalid Inputs", () => {
    it("fallback to default timezone for invalid TZ string", () => {
      // Note: Dayjs might fallback to local or ignore.
      // This test checks if we stay resilient.
      const date = new Date("2025-02-10T12:00:00Z");
      const result = getInTimezone(date, "INVALID_TZ");
      expect(result.isValid()).toBe(true);
    });

    it("handles malformed date strings gracefully", () => {
      const result = getInTimezone("not-a-date", NY_TZ);
      expect(result.isValid()).toBe(false);
    });
  });
});
