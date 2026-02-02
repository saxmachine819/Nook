import { describe, it, expect, vi, beforeEach } from "vitest"
import { getEffectiveVenueHours, syncVenueHoursFromGoogle } from "@/lib/venue-hours"

describe("hours precedence", () => {
  describe("getEffectiveVenueHours", () => {
    const manualRow = (day: number, open: string, close: string) => ({
      dayOfWeek: day,
      isClosed: false,
      openTime: open,
      closeTime: close,
      source: "manual" as const,
    })
    const googleRow = (day: number, open: string, close: string) => ({
      dayOfWeek: day,
      isClosed: false,
      openTime: open,
      closeTime: close,
      source: "google" as const,
    })

    it("returns only manual rows when hoursSource is manual", () => {
      const mixed = [
        manualRow(0, "09:00", "17:00"),
        googleRow(0, "08:00", "20:00"),
        manualRow(1, "10:00", "18:00"),
      ]
      const effective = getEffectiveVenueHours(mixed, "manual")
      expect(effective).toHaveLength(2)
      expect(effective.every((h) => h.source === "manual")).toBe(true)
      expect(effective.map((h) => h.dayOfWeek).sort()).toEqual([0, 1])
    })

    it("returns only google rows when hoursSource is google", () => {
      const mixed = [
        manualRow(0, "09:00", "17:00"),
        googleRow(0, "08:00", "20:00"),
        googleRow(1, "08:00", "20:00"),
      ]
      const effective = getEffectiveVenueHours(mixed, "google")
      expect(effective).toHaveLength(2)
      expect(effective.every((h) => h.source === "google")).toBe(true)
    })

    it("returns only google rows when hoursSource is null (default)", () => {
      const mixed = [
        manualRow(0, "09:00", "17:00"),
        googleRow(0, "08:00", "20:00"),
      ]
      const effective = getEffectiveVenueHours(mixed, null)
      expect(effective).toHaveLength(1)
      expect(effective[0].source).toBe("google")
    })

    it("treats rows with undefined source as google (legacy)", () => {
      const legacy = [
        { dayOfWeek: 0, isClosed: false, openTime: "09:00", closeTime: "17:00" },
      ]
      const effective = getEffectiveVenueHours(legacy, null)
      expect(effective).toHaveLength(1)
    })

    it("returns empty when no rows", () => {
      expect(getEffectiveVenueHours([], "manual")).toEqual([])
      expect(getEffectiveVenueHours([], "google")).toEqual([])
    })
  })

  describe("syncVenueHoursFromGoogle when hoursSource=manual", () => {
    it("does not overwrite manual rows: only upserts days that are not already manual", async () => {
      const upsertCalls: { dayOfWeek: number }[] = []
      const mockPrisma = {
        venueHours: {
          findMany: vi.fn().mockResolvedValue([
            { dayOfWeek: 0, source: "manual" },
            { dayOfWeek: 1, source: "manual" },
            { dayOfWeek: 2, source: "google" },
            { dayOfWeek: 3, source: "google" },
            { dayOfWeek: 4, source: "google" },
            { dayOfWeek: 5, source: "google" },
            { dayOfWeek: 6, source: "google" },
          ]),
          upsert: vi.fn().mockImplementation((args: { where: { venueId_dayOfWeek: { dayOfWeek: number } } }) => {
            upsertCalls.push({ dayOfWeek: args.where.venueId_dayOfWeek.dayOfWeek })
            return Promise.resolve()
          }),
        },
      }
      const hoursData = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        venueId: "v1",
        dayOfWeek,
        isClosed: false,
        openTime: "08:00",
        closeTime: "20:00",
        source: "google",
      }))
      await syncVenueHoursFromGoogle(mockPrisma, "v1", hoursData, "manual")
      // Should not upsert day 0 or 1 (already manual)
      expect(upsertCalls.map((c) => c.dayOfWeek).sort()).toEqual([2, 3, 4, 5, 6])
    })

    it("upserts all days when hoursSource is null", async () => {
      const upsertCalls: number[] = []
      const mockPrisma = {
        venueHours: {
          upsert: vi.fn().mockImplementation((args: { where: { venueId_dayOfWeek: { dayOfWeek: number } } }) => {
            upsertCalls.push(args.where.venueId_dayOfWeek.dayOfWeek)
            return Promise.resolve()
          }),
        },
      }
      const hoursData = [0, 1, 2].map((dayOfWeek) => ({
        venueId: "v1",
        dayOfWeek,
        isClosed: false,
        openTime: "09:00",
        closeTime: "17:00",
        source: "google",
      }))
      await syncVenueHoursFromGoogle(mockPrisma, "v1", hoursData, null)
      expect(upsertCalls.sort()).toEqual([0, 1, 2])
    })
  })
})
