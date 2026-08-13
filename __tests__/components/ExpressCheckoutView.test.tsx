// @vitest-environment jsdom

import React from "react"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react"
import { ExpressCheckoutView } from "@/components/venue/ExpressCheckoutView"

const replace = vi.fn()
const confirmPayment = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
}))

vi.mock("@/lib/stripe-client", () => ({
  getStripe: () => Promise.resolve({ id: "stripe" }),
}))

// The real Elements need a live Stripe connection. These stubs expose the two
// callbacks the component depends on so the flow around them can be driven directly.
let expressHandlers: {
  onReady?: (event: { availablePaymentMethods?: Record<string, boolean> }) => void
  onConfirm?: () => void
} = {}
let expressOptions: Record<string, unknown> = {}

vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ExpressCheckoutElement: (props: any) => {
    expressHandlers = { onReady: props.onReady, onConfirm: props.onConfirm }
    expressOptions = props.options
    return (
      <button type="button" data-testid="express-element" onClick={() => props.onConfirm?.()}>
        Apple Pay
      </button>
    )
  },
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({ confirmPayment }),
  useElements: () => ({}),
}))

const BASE_PROPS = {
  clientSecret: "pi_123_secret_abc",
  paymentId: "payment-1",
  stripeAccountId: "acct_venue",
  amountCents: 340,
  venueName: "Test Venue",
}

/** Mount and wait for the async Stripe load to resolve. */
async function renderView(props: Partial<typeof BASE_PROPS> = {}) {
  const result = render(<ExpressCheckoutView {...BASE_PROPS} {...props} />)
  await screen.findByTestId("express-element")
  return result
}

function mockStatus(...responses: Array<Record<string, unknown>>) {
  const fetchMock = vi.fn()
  responses.forEach((body) => {
    fetchMock.mockResolvedValueOnce({ json: () => Promise.resolve(body) })
  })
  global.fetch = fetchMock as any
  return fetchMock
}

describe("ExpressCheckoutView", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    expressHandlers = {}
    expressOptions = {}
    confirmPayment.mockResolvedValue({})
  })

  it("shows the amount the customer is about to pay", async () => {
    await renderView()
    expect(screen.getByText("$3.40")).toBeInTheDocument()
    expect(screen.getByText("Test Venue")).toBeInTheDocument()
  })

  it("puts the wallet button first and keeps the card form out of the way", async () => {
    await renderView()
    act(() => expressHandlers.onReady?.({ availablePaymentMethods: { applePay: true } }))

    await waitFor(() => {
      expect(screen.getByText("Pay another way")).toBeInTheDocument()
    })
    expect(screen.queryByTestId("payment-element")).not.toBeInTheDocument()
  })

  it("reveals the card form on request", async () => {
    await renderView()
    act(() => expressHandlers.onReady?.({ availablePaymentMethods: { applePay: true } }))

    fireEvent.click(await screen.findByText("Pay another way"))

    expect(screen.getByTestId("payment-element")).toBeInTheDocument()
  })

  it("shows the card form immediately when the device has no wallet", async () => {
    await renderView()
    act(() => expressHandlers.onReady?.({ availablePaymentMethods: {} }))

    await waitFor(() => {
      expect(screen.getByTestId("payment-element")).toBeInTheDocument()
    })
    expect(screen.queryByText("Pay another way")).not.toBeInTheDocument()
  })

  it("does not ask for an email the signed-in customer already gave us", async () => {
    await renderView()
    expect(expressOptions.emailRequired).toBe(false)
    expect(expressOptions.paymentMethods).toMatchObject({
      applePay: "always",
      googlePay: "always",
    })
  })

  it("sends the customer to their reservation once the payment is confirmed", async () => {
    mockStatus({ status: "paid", reservationId: "reservation-1" })
    await renderView()

    fireEvent.click(screen.getByTestId("express-element"))

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/reservations/reservation-1")
    })
    expect(confirmPayment).toHaveBeenCalledWith(
      expect.objectContaining({ redirect: "if_required" })
    )
  })

  it("does not navigate when Stripe rejects the payment", async () => {
    confirmPayment.mockResolvedValue({ error: { message: "Your card was declined." } })
    await renderView()

    fireEvent.click(screen.getByTestId("express-element"))

    expect(await screen.findByRole("alert")).toHaveTextContent("Your card was declined.")
    expect(replace).not.toHaveBeenCalled()
  })

  it("explains a refund rather than leaving the customer guessing", async () => {
    mockStatus({ status: "refunded", reason: "Reservation not found" })
    await renderView()

    fireEvent.click(screen.getByTestId("express-element"))

    expect(await screen.findByRole("alert")).toHaveTextContent(/refunded/i)
    expect(replace).not.toHaveBeenCalled()
  })

  it("reports a failed payment without navigating away", async () => {
    mockStatus({ status: "failed" })
    await renderView()

    fireEvent.click(screen.getByTestId("express-element"))

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be completed/i)
    expect(replace).not.toHaveBeenCalled()
  })

  it("returns to the reservation once a slow confirmation lands", async () => {
    mockStatus(
      { status: "pending" },
      { status: "paid", reservationId: "reservation-2" }
    )
    await renderView()

    fireEvent.click(screen.getByTestId("express-element"))

    await waitFor(
      () => {
        expect(replace).toHaveBeenCalledWith("/reservations/reservation-2")
      },
      { timeout: 5000 }
    )
  })
})
