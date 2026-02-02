import { describe, it, expect } from "vitest"
import { computeAvailabilityLabel } from "@/lib/availability-utils"
import type { OpenStatus } from "@/lib/hours"

describe("computeAvailabilityLabel", () => {
  describe("capacity checks", () => {
    it('returns "Sold out for now" when capacity is 0', () => {
      const openStatus: OpenStatus = {
        isOpen: true,
        status: "OPEN_NOW",
        todayLabel: "Mon",
        todayHoursText: "9:00 AM – 5:00 PM",
      }
      const result = computeAvailabilityLabel(0, [], openStatus)
      expect(result).toBe("Sold out for now")
    })

    it('returns "Sold out for now" when capacity is negative', () => {
      const openStatus: OpenStatus = {
        isOpen: true,
        status: "OPEN_NOW",
        todayLabel: "Mon",
        todayHoursText: "9:00 AM – 5:00 PM",
      }
      const result = computeAvailabilityLabel(-1, [], openStatus)
      expect(result).toBe("Sold out for now")
    })
  })

  describe("no hours data", () => {
    it('returns "Currently Closed" when openStatus is null', () => {
      const result = computeAvailabilityLabel(10, [], null)
      expect(result).toBe("Currently Closed")
    })
  })

  describe("venue closed scenarios", () => {
    it('returns "Currently Closed" when closed and no next open time', () => {
      const openStatus: OpenStatus = {
        isOpen: false,
        status: "CLOSED_TODAY",
        todayLabel: "Mon",
        todayHoursText: "Closed",
      }
      const result = computeAvailabilityLabel(10, [], openStatus)
      expect(result).toBe("Currently Closed")
    })

    it('returns "Opens at [time]" when closed but opens later today', () => {
      const now = new Date()
      const laterToday = new Date(now)
      laterToday.setHours(now.getHours() + 2, 0, 0, 0)
      const openStatus: OpenStatus = {
        isOpen: false,
        status: "OPENS_LATER",
        todayLabel: "Mon",
        todayHoursText: "9:00 AM – 5:00 PM",
        nextOpenAt: laterToday,
      }
      const result = computeAvailabilityLabel(10, [], openStatus)
      expect(result).toContain("Opens at")
      expect(result).not.toContain("tomorrow")
    })

    it('returns "Opens tomorrow at [time]" when closed and opens tomorrow', () => {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(9, 0, 0, 0)
      const openStatus: OpenStatus = {
        isOpen: false,
        status: "CLOSED_NOW",
        todayLabel: "Mon",
        todayHoursText: "Closed",
        nextOpenAt: tomorrow,
      }
      const result = computeAvailabilityLabel(10, [], openStatus)
      expect(result).toContain("Opens tomorrow at")
    })

    it('returns "Opens [day] at [time]" when closed and opens in 2+ days', () => {
      const now = new Date()
      const futureDay = new Date(now)
      futureDay.setDate(futureDay.getDate() + 3)
      futureDay.setHours(10, 0, 0, 0)
      const openStatus: OpenStatus = {
        isOpen: false,
        status: "CLOSED_TODAY",
        todayLabel: "Mon",
        todayHoursText: "Closed",
        nextOpenAt: futureDay,
      }
      const result = computeAvailabilityLabel(10, [], openStatus)
      expect(result).toContain("Opens")
      expect(result).toContain("at")
      expect(result).not.toContain("tomorrow")
    })
  })

  describe("venue open scenarios", () => {
    it('returns "Available now" when open and has capacity', () => {
      const openStatus: OpenStatus = {
        isOpen: true,
        status: "OPEN_NOW",
        todayLabel: "Mon",
        todayHoursText: "9:00 AM – 5:00 PM",
      }
      const result = computeAvailabilityLabel(10, [], openStatus)
      expect(result).toBe("Available now")
    })

    it('returns "Available now" when open and partially booked', () => {
      const openStatus: OpenStatus = {
        isOpen: true,
        status: "OPEN_NOW",
        todayLabel: "Mon",
        todayHoursText: "9:00 AM – 5:00 PM",
      }
      const now = new Date()
      const startAt = new Date(now.getTime() + 60 * 60 * 1000)
      const endAt = new Date(now.getTime() + 2 * 60 * 60 * 1000)
      const reservations = [{ startAt, endAt, seatCount: 5 }]
      const result = computeAvailabilityLabel(10, reservations, openStatus)
      expect(result).toBe("Available now")
    })

    it('returns "Next availability @ [time]" when open but fully booked now', () => {
      const openStatus: OpenStatus = {
        isOpen: true,
        status: "OPEN_NOW",
        todayLabel: "Mon",
        todayHoursText: "9:00 AM – 5:00 PM",
      }
      const now = new Date()
      const startAt = new Date(now.getTime() + 15 * 60 * 1000)
      const endAt = new Date(now.getTime() + 60 * 60 * 1000)
      const reservations = [{ startAt, endAt, seatCount: 10 }]
      const result = computeAvailabilityLabel(10, reservations, openStatus)
      expect(result).toContain("Next availability @")
    })

    it('returns "Sold out for now" when open but fully booked for 12 hours', () => {
      const openStatus: OpenStatus = {
        isOpen: true,
        status: "OPEN_NOW",
        todayLabel: "Mon",
        todayHoursText: "9:00 AM – 5:00 PM",
      }
      const now = new Date()
      const reservations = []
      for (let i = 0; i < 12; i++) {
        const startAt = new Date(now.getTime() + i * 60 * 60 * 1000)
        const endAt = new Date(now.getTime() + (i + 1) * 60 * 60 * 1000)
        reservations.push({ startAt, endAt, seatCount: 10 })
      }
      const result = computeAvailabilityLabel(10, reservations, openStatus)
      expect(result).toBe("Sold out for now")
    })
  })

  describe("timezone", () => {
    it("formats nextOpenAt in venue timezone (12:30 UTC = 7:30 AM ET)", () => {
      // 2025-02-03 12:30 UTC = 7:30 AM Eastern
      const nextOpenAt = new Date("2025-02-03T12:30:00.000Z")
      const openStatus: OpenStatus = {
        isOpen: false,
        status: "CLOSED_NOW",
        todayLabel: "Sun",
        todayHoursText: "Closed",
        nextOpenAt,
      }
      const result = computeAvailabilityLabel(10, [], openStatus, {
        timeZone: "America/New_York",
      })
      expect(result).toContain("Opens")
      expect(result).toContain("at")
      expect(result).toContain("7:30 AM")
    })

    it("uses venue timezone for day and time (same UTC moment displays as 7:30 AM in ET)", () => {
      const nextOpenAt = new Date("2025-02-03T12:30:00.000Z")
      const openStatus: OpenStatus = {
        isOpen: false,
        status: "CLOSED_NOW",
        todayLabel: "Sun",
        todayHoursText: "Closed",
        nextOpenAt,
      }
      const result = computeAvailabilityLabel(10, [], openStatus, {
        timeZone: "America/New_York",
      })
      expect(result).toContain("7:30 AM")
      expect(result).toMatch(/^Opens (at|tomorrow|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday) at /)
    })
  })

  describe("edge cases", () => {
    it("handles overlapping reservations correctly", () => {
      const openStatus: OpenStatus = {
        isOpen: true,
        status: "OPEN_NOW",
        todayLabel: "Mon",
        todayHoursText: "9:00 AM – 5:00 PM",
      }
      const now = new Date()
      const startAt1 = new Date(now.getTime() + 30 * 60 * 1000)
      const endAt1 = new Date(now.getTime() + 90 * 60 * 1000)
      const startAt2 = new Date(now.getTime() + 60 * 60 * 1000)
      const endAt2 = new Date(now.getTime() + 120 * 60 * 1000)
      const reservations = [
        { startAt: startAt1, endAt: endAt1, seatCount: 5 },
        { startAt: startAt2, endAt: endAt2, seatCount: 6 },
      ]
      const result = computeAvailabilityLabel(10, reservations, openStatus)
      expect(result).toContain("Next availability @")
    })
  })
})
