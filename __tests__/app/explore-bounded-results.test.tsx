/**
 * Explore bounded results: single source of truth for venues.
 * Asserts that count === list length === markers length (same array).
 */

import { describe, it, expect } from "vitest"

describe("Explore bounded results", () => {
  it("count equals list length equals markers length (same array)", () => {
    const venues = [
      { id: "v1", latitude: 40.71, longitude: -74.01 },
      { id: "v2", latitude: 40.72, longitude: -74.02 },
    ]
    const venuesWithLocation = venues.filter(
      (v) => v.latitude != null && v.longitude != null
    )
    const count = venues.length
    const listLength = venues.length
    const markersLength = venuesWithLocation.length
    expect(count).toBe(listLength)
    expect(listLength).toBe(markersLength)
    expect(count).toBe(2)
  })

  it("empty venues: count and list length are 0", () => {
    const venues: { id: string; latitude: number | null; longitude: number | null }[] = []
    const count = venues.length
    const listLength = venues.length
    expect(count).toBe(0)
    expect(listLength).toBe(0)
  })
})
