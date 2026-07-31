import { describe, it, expect } from "vitest"
import { isReservationReviewable, isValidRating } from "@/lib/review-eligibility"

describe("isReservationReviewable", () => {
  const now = new Date("2026-07-30T14:00:00Z")

  it("is reviewable when the reservation is active and ended in the past", () => {
    const reservation = {
      status: "active",
      endAt: new Date("2026-07-30T13:00:00Z"),
    }
    expect(isReservationReviewable(reservation, now)).toBe(true)
  })

  it("is not reviewable when the reservation is upcoming", () => {
    const reservation = {
      status: "active",
      endAt: new Date("2026-07-30T15:00:00Z"),
    }
    expect(isReservationReviewable(reservation, now)).toBe(false)
  })

  it("is not reviewable when the reservation is currently in progress", () => {
    const reservation = {
      status: "active",
      endAt: now, // ends exactly now, matches the "past" tab's exclusive endAt < now
    }
    expect(isReservationReviewable(reservation, now)).toBe(false)
  })

  it("is not reviewable when the reservation was cancelled, regardless of date", () => {
    const reservation = {
      status: "cancelled",
      endAt: new Date("2026-07-30T13:00:00Z"),
    }
    expect(isReservationReviewable(reservation, now)).toBe(false)
  })

  it("accepts endAt as an ISO string", () => {
    const reservation = {
      status: "active",
      endAt: "2026-07-30T13:00:00Z",
    }
    expect(isReservationReviewable(reservation, now)).toBe(true)
  })
})

describe("isValidRating", () => {
  it.each([1, 2, 3, 4, 5])("accepts integer rating %i", (rating) => {
    expect(isValidRating(rating)).toBe(true)
  })

  it.each([0, 6, -1, 1.5, NaN])("rejects out-of-range or non-integer rating %s", (rating) => {
    expect(isValidRating(rating)).toBe(false)
  })

  it.each([undefined, null, "5", {}])("rejects non-number rating %s", (rating) => {
    expect(isValidRating(rating)).toBe(false)
  })
})
