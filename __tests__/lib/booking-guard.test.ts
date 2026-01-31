import { describe, it, expect, beforeEach, vi } from "vitest"
import { createTestVenue, createTestUser } from "../helpers/test-utils"
import { canBookVenue, getVenueBookability, BookingNotAllowedError } from "@/lib/booking-guard"

const mockVenueFindUnique = vi.hoisted(() => vi.fn())
vi.mock("@/lib/prisma", () => ({
  prisma: {
    venue: { findUnique: mockVenueFindUnique },
    seat: { findUnique: vi.fn() },
    table: { findUnique: vi.fn() },
  },
}))

describe("booking-guard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("canBookVenue", () => {
    it("throws VENUE_NOT_FOUND when venue does not exist", async () => {
      mockVenueFindUnique.mockResolvedValue(null)

      await expect(canBookVenue("nonexistent")).rejects.toThrow(BookingNotAllowedError)
      await expect(canBookVenue("nonexistent")).rejects.toMatchObject({
        code: "VENUE_NOT_FOUND",
      })
    })

    it("throws VENUE_DELETED when venue status is DELETED", async () => {
      const venue = createTestVenue({ id: "v1", status: "DELETED", deletedAt: new Date() })
      mockVenueFindUnique.mockResolvedValue(venue as any)

      await expect(canBookVenue("v1")).rejects.toThrow(BookingNotAllowedError)
      await expect(canBookVenue("v1")).rejects.toMatchObject({
        code: "VENUE_DELETED",
      })
    })

    it("throws VENUE_PAUSED when venue status is PAUSED", async () => {
      const venue = createTestVenue({
        id: "v1",
        status: "PAUSED",
        pauseMessage: "Closed for repairs",
        owner: createTestUser({ status: "ACTIVE" }),
      })
      mockVenueFindUnique.mockResolvedValue(venue as any)

      await expect(canBookVenue("v1")).rejects.toThrow(BookingNotAllowedError)
      await expect(canBookVenue("v1")).rejects.toMatchObject({
        code: "VENUE_PAUSED",
        publicMessage: "Closed for repairs",
      })
    })

    it("throws OWNER_DELETED when venue owner is deleted", async () => {
      const venue = createTestVenue({
        id: "v1",
        status: "ACTIVE",
        owner: createTestUser({ id: "owner-1", status: "DELETED" }),
      })
      mockVenueFindUnique.mockResolvedValue(venue as any)

      await expect(canBookVenue("v1")).rejects.toThrow(BookingNotAllowedError)
      await expect(canBookVenue("v1")).rejects.toMatchObject({
        code: "OWNER_DELETED",
      })
    })

    it("does not throw when venue is ACTIVE and owner is ACTIVE", async () => {
      const venue = createTestVenue({
        id: "v1",
        status: "ACTIVE",
        owner: createTestUser({ status: "ACTIVE" }),
      })
      mockVenueFindUnique.mockResolvedValue(venue as any)

      await expect(canBookVenue("v1")).resolves.toBeUndefined()
    })
  })

  describe("getVenueBookability", () => {
    it("returns canBook: false and status DELETED when venue not found", async () => {
      mockVenueFindUnique.mockResolvedValue(null)

      const result = await getVenueBookability("nonexistent")
      expect(result).toEqual({
        canBook: false,
        reason: "Venue not found.",
        status: "DELETED",
      })
    })

    it("returns canBook: false and status PAUSED when venue is PAUSED", async () => {
      const venue = createTestVenue({
        id: "v1",
        status: "PAUSED",
        pauseMessage: "Back soon",
        owner: createTestUser({ status: "ACTIVE" }),
      })
      mockVenueFindUnique.mockResolvedValue(venue as any)

      const result = await getVenueBookability("v1")
      expect(result).toEqual({
        canBook: false,
        reason: "Back soon",
        pauseMessage: "Back soon",
        status: "PAUSED",
      })
    })

    it("returns canBook: true and status ACTIVE when venue is ACTIVE", async () => {
      const venue = createTestVenue({
        id: "v1",
        status: "ACTIVE",
        owner: createTestUser({ status: "ACTIVE" }),
      })
      mockVenueFindUnique.mockResolvedValue(venue as any)

      const result = await getVenueBookability("v1")
      expect(result).toEqual({ canBook: true, status: "ACTIVE" })
    })
  })
})
