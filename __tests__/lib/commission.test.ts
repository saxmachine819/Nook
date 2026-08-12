import { describe, it, expect } from "vitest"
import { COMMISSION_RATE } from "@/lib/commission"

function applicationFeeAmount(subtotalCents: number, amountCents: number) {
  const nookCommission = Math.round(subtotalCents * COMMISSION_RATE)
  return Math.max(0, Math.min(amountCents, nookCommission))
}

describe("COMMISSION_RATE", () => {
  it("is 30%, giving the venue a 70% share", () => {
    expect(COMMISSION_RATE).toBe(0.3)
  })

  it.each([
    { subtotalCents: 300, amountCents: 340, expectedFee: 90, expectedVenue: 210 },
    { subtotalCents: 1000, amountCents: 1063, expectedFee: 300, expectedVenue: 700 },
    { subtotalCents: 999, amountCents: 1060, expectedFee: 300, expectedVenue: 699 },
    { subtotalCents: 5000, amountCents: 5175, expectedFee: 1500, expectedVenue: 3500 },
  ])(
    "takes 30% of the subtotal, leaving the venue 70% (subtotal=$subtotalCents)",
    ({ subtotalCents, amountCents, expectedFee, expectedVenue }) => {
      const fee = applicationFeeAmount(subtotalCents, amountCents)
      expect(fee).toBe(expectedFee)
      expect(subtotalCents - fee).toBe(expectedVenue)
    }
  )

  it("never lets the fee exceed the total amount charged", () => {
    const fee = applicationFeeAmount(2000, 100)
    expect(fee).toBe(100)
  })

  it("never produces a negative fee", () => {
    const fee = applicationFeeAmount(0, 0)
    expect(fee).toBe(0)
  })
})
