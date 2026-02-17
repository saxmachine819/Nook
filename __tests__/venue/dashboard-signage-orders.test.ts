/**
 * Venue dashboard signage orders: data shape and counts.
 * Run with: npm test -- dashboard
 */

import { describe, it, expect } from "vitest"

function getSignageOrderCounts(items: Array<{ qrScopeType: string }>) {
  const storeCount = items.filter((i) => i.qrScopeType === "STORE").length
  const tableCount = items.filter((i) => i.qrScopeType === "TABLE").length
  const seatCount = items.filter((i) => i.qrScopeType === "SEAT").length
  return { storeCount, tableCount, seatCount }
}

describe("Venue dashboard signage orders", () => {
  it("derives store/table/seat counts from order items", () => {
    const items = [
      { qrScopeType: "STORE" },
      { qrScopeType: "TABLE" },
      { qrScopeType: "TABLE" },
      { qrScopeType: "SEAT" },
    ]
    const counts = getSignageOrderCounts(items)
    expect(counts.storeCount).toBe(1)
    expect(counts.tableCount).toBe(2)
    expect(counts.seatCount).toBe(1)
  })

  it("returns zeros for empty items", () => {
    const counts = getSignageOrderCounts([])
    expect(counts.storeCount).toBe(0)
    expect(counts.tableCount).toBe(0)
    expect(counts.seatCount).toBe(0)
  })
})
