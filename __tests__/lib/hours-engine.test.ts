import { describe, it, expect } from "vitest"
import { getOpenStatus, type CanonicalVenueHours } from "@/lib/hours"

const TZ = "America/New_York"
// Monday Feb 3, 2025 in America/New_York
const MONDAY_10_00_EST = new Date("2025-02-03T15:00:00.000Z") // 10:00 EST
const MONDAY_08_00_EST = new Date("2025-02-03T13:00:00.000Z") // 08:00 EST
const MONDAY_12_00_EST = new Date("2025-02-03T17:00:00.000Z") // 12:00 noon EST
const MONDAY_18_00_EST = new Date("2025-02-03T23:00:00.000Z") // 18:00 EST (after 5pm close)

describe("hours engine", () => {
  describe("getOpenStatus", () => {
    const canonicalMon9to5: CanonicalVenueHours = {
      timezone: TZ,
      weeklyHours: [
        { dayOfWeek: 0, isClosed: true, openTime: null, closeTime: null },
        { dayOfWeek: 1, isClosed: false, openTime: "09:00", closeTime: "17:00" }, // Mon
        { dayOfWeek: 2, isClosed: false, openTime: "09:00", closeTime: "17:00" },
        { dayOfWeek: 3, isClosed: false, openTime: "09:00", closeTime: "17:00" },
        { dayOfWeek: 4, isClosed: false, openTime: "09:00", closeTime: "17:00" },
        { dayOfWeek: 5, isClosed: false, openTime: "09:00", closeTime: "17:00" },
        { dayOfWeek: 6, isClosed: true, openTime: null, closeTime: null },
      ],
    }

    it("open now: returns OPEN_NOW and today hours text when at is within open window", () => {
      const result = getOpenStatus(canonicalMon9to5, MONDAY_10_00_EST)
      expect(result.isOpen).toBe(true)
      expect(result.status).toBe("OPEN_NOW")
      expect(result.todayLabel).toBe("Mon")
      expect(result.todayHoursText).toMatch(/9:00 AM.*5:00 PM/)
      expect(result.nextOpenAt).toBeUndefined()
      expect(result.diagnosticMessage).toBeUndefined()
    })

    it("closed now but opens later: returns OPENS_LATER and nextOpenAt today at openTime", () => {
      const result = getOpenStatus(canonicalMon9to5, MONDAY_08_00_EST)
      expect(result.isOpen).toBe(false)
      expect(result.status).toBe("OPENS_LATER")
      expect(result.todayLabel).toBe("Mon")
      expect(result.todayHoursText).toMatch(/9:00 AM.*5:00 PM/)
      expect(result.nextOpenAt).toBeDefined()
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: TZ,
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: false,
      })
      expect(formatter.format(result.nextOpenAt!)).toMatch(/Mon.*9:00/)
      expect(result.diagnosticMessage).toBeUndefined()
    })

    it("closed all day: returns CLOSED_TODAY and todayHoursText Closed when no row for today", () => {
      const canonicalMonClosed: CanonicalVenueHours = {
        timezone: TZ,
        weeklyHours: [
          { dayOfWeek: 0, isClosed: true, openTime: null, closeTime: null },
          { dayOfWeek: 1, isClosed: true, openTime: null, closeTime: null }, // Mon closed
          { dayOfWeek: 2, isClosed: false, openTime: "09:00", closeTime: "17:00" },
          { dayOfWeek: 3, isClosed: false, openTime: "09:00", closeTime: "17:00" },
          { dayOfWeek: 4, isClosed: false, openTime: "09:00", closeTime: "17:00" },
          { dayOfWeek: 5, isClosed: false, openTime: "09:00", closeTime: "17:00" },
          { dayOfWeek: 6, isClosed: true, openTime: null, closeTime: null },
        ],
      }
      const result = getOpenStatus(canonicalMonClosed, MONDAY_12_00_EST)
      expect(result.isOpen).toBe(false)
      expect(result.status).toBe("CLOSED_TODAY")
      expect(result.todayLabel).toBe("Mon")
      expect(result.todayHoursText).toBe("Closed")
      expect(result.nextOpenAt).toBeDefined()
      expect(result.diagnosticMessage).toBeUndefined()
    })

    it("closed now (after close time): returns CLOSED_NOW and nextOpenAt tomorrow", () => {
      const result = getOpenStatus(canonicalMon9to5, MONDAY_18_00_EST)
      expect(result.isOpen).toBe(false)
      expect(result.status).toBe("CLOSED_NOW")
      expect(result.todayLabel).toBe("Mon")
      expect(result.todayHoursText).toBe("Closed")
      expect(result.nextOpenAt).toBeDefined()
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: TZ,
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: false,
      })
      expect(formatter.format(result.nextOpenAt!)).toMatch(/Tue.*9:00/)
    })

    it("getOpenStatus is deterministic: same canonical + at yields same result (explore and venue page use same engine)", () => {
      const at = new Date("2025-02-03T15:00:00.000Z")
      const r1 = getOpenStatus(canonicalMon9to5, at)
      const r2 = getOpenStatus(canonicalMon9to5, at)
      expect(r1.isOpen).toBe(r2.isOpen)
      expect(r1.status).toBe(r2.status)
      expect(r1.todayHoursText).toBe(r2.todayHoursText)
    })

    it("closed all day when today has no row: returns CLOSED_TODAY", () => {
      const canonicalMonMissing: CanonicalVenueHours = {
        timezone: TZ,
        weeklyHours: [
          { dayOfWeek: 0, isClosed: true, openTime: null, closeTime: null },
          { dayOfWeek: 2, isClosed: false, openTime: "09:00", closeTime: "17:00" },
          { dayOfWeek: 3, isClosed: false, openTime: "09:00", closeTime: "17:00" },
          { dayOfWeek: 4, isClosed: false, openTime: "09:00", closeTime: "17:00" },
          { dayOfWeek: 5, isClosed: false, openTime: "09:00", closeTime: "17:00" },
          { dayOfWeek: 6, isClosed: true, openTime: null, closeTime: null },
        ],
      }
      const result = getOpenStatus(canonicalMonMissing, MONDAY_12_00_EST)
      expect(result.isOpen).toBe(false)
      expect(result.status).toBe("CLOSED_TODAY")
      expect(result.todayHoursText).toBe("Closed")
    })
  })
})
