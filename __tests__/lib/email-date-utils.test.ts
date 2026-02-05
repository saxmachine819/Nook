import { describe, it, expect } from "vitest"
import {
  formatDateTimeInTimezone,
  formatTimeRangeInTimezone,
} from "@/lib/email-date-utils"

describe("email-date-utils", () => {
  describe("formatDateTimeInTimezone", () => {
    // 2025-02-05T19:30:00.000Z = 2:30 PM Eastern (UTC-5)
    const iso2_30pmEastern = "2025-02-05T19:30:00.000Z"

    it("formats ISO string in venue timezone (America/New_York)", () => {
      const result = formatDateTimeInTimezone(iso2_30pmEastern, "America/New_York")
      // Should show 2:30 PM local (Eastern), not 7:30 PM (UTC)
      expect(result).toMatch(/2:30\s*PM/i)
      expect(result).not.toMatch(/7:30\s*PM/i)
    })

    it("uses default America/New_York when timeZone is undefined", () => {
      const result = formatDateTimeInTimezone(iso2_30pmEastern)
      expect(result).toMatch(/2:30\s*PM/i)
    })

    it("uses default when timeZone is empty string", () => {
      const result = formatDateTimeInTimezone(iso2_30pmEastern, " ")
      expect(result).toMatch(/2:30\s*PM/i)
    })

    it("formats in different timezone when provided", () => {
      // 19:30 UTC = 2:30 PM ET = 11:30 AM PT
      const result = formatDateTimeInTimezone(iso2_30pmEastern, "America/Los_Angeles")
      expect(result).toMatch(/11:30\s*AM/i)
    })

    it("returns original string for invalid ISO", () => {
      expect(formatDateTimeInTimezone("not-a-date")).toBe("not-a-date")
    })
  })

  describe("formatTimeRangeInTimezone", () => {
    // 2:30 PM – 4:30 PM Eastern
    const startAt = "2025-02-05T19:30:00.000Z"
    const endAt = "2025-02-05T21:30:00.000Z"

    it("formats time range in venue timezone", () => {
      const result = formatTimeRangeInTimezone(startAt, endAt, "America/New_York")
      expect(result).toMatch(/2:30\s*PM/i)
      expect(result).toMatch(/4:30\s*PM/i)
      expect(result).toContain("–")
    })

    it("uses default timezone when not provided", () => {
      const result = formatTimeRangeInTimezone(startAt, endAt)
      expect(result).toMatch(/2:30\s*PM/i)
      expect(result).toMatch(/4:30\s*PM/i)
    })
  })
})
