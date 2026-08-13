import { describe, it, expect, beforeEach, vi } from 'vitest'
import type Stripe from 'stripe'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { auth } from '@/lib/auth'
import { COMMISSION_RATE } from '@/lib/commission'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    reservation: { create: vi.fn() },
    payment: { create: vi.fn(), update: vi.fn() },
  },
}))

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: { sessions: { create: vi.fn() } },
    paymentIntents: { create: vi.fn() },
  },
}))

vi.mock('@/lib/stripe-payment-method-domains', () => ({
  ensureWalletDomainsCached: vi.fn().mockResolvedValue({ domains: [] }),
  isApplePayReady: vi.fn().mockReturnValue(true),
  requestHost: vi.fn().mockReturnValue('nooc.io'),
  summarizeWalletDomainReport: vi.fn().mockReturnValue(''),
}))

const buildBookingContext = vi.fn()
const computeBookingPrice = vi.fn()

vi.mock('@/lib/booking', () => ({
  buildBookingContext: (...args: unknown[]) => buildBookingContext(...args),
  computeBookingPrice: (...args: unknown[]) => computeBookingPrice(...args),
}))

const { POST } = await import('@/app/api/payments/checkout/route')

// $3.00 subtotal grossed up for the 3% processing fee, matching computeBookingPrice.
const SUBTOTAL_CENTS = 300
const AMOUNT_CENTS = 340

function bookingRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/payments/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const BASE_BODY = {
  venueId: 'venue-1',
  seatIds: ['seat-1'],
  startAt: '2026-09-01T15:00:00.000Z',
  endAt: '2026-09-01T17:00:00.000Z',
}

// Both Stripe methods are overloaded with an options-only signature, so TypeScript
// can't tell which tuple `mock.calls` holds. These pin it to the (params, options) form.
function sessionCall(index = 0) {
  return vi.mocked(stripe.checkout.sessions.create).mock.calls[index] as unknown as [
    Stripe.Checkout.SessionCreateParams,
    Stripe.RequestOptions | undefined,
  ]
}

function intentCall(index = 0) {
  return vi.mocked(stripe.paymentIntents.create).mock.calls[index] as unknown as [
    Stripe.PaymentIntentCreateParams,
    Stripe.RequestOptions | undefined,
  ]
}

describe('POST /api/payments/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = 'https://nooc.io'

    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      email: 'guest@example.com',
      termsAcceptedAt: new Date(),
    } as any)

    buildBookingContext.mockResolvedValue({
      venueId: 'venue-1',
      isGroupBooking: false,
      finalSeatIds: ['seat-1'],
      tableId: null,
      seats: [{ id: 'seat-1', tableId: 'table-1' }],
      parsedStart: new Date(BASE_BODY.startAt),
      parsedEnd: new Date(BASE_BODY.endAt),
      venue: { id: 'venue-1', name: 'Test Venue', stripeAccountId: 'acct_venue' },
      table: null,
      requestedSeatCount: null,
    })

    computeBookingPrice.mockReturnValue({
      subtotalCents: SUBTOTAL_CENTS,
      processingFeeCents: AMOUNT_CENTS - SUBTOTAL_CENTS,
      amountCents: AMOUNT_CENTS,
    })

    vi.mocked(prisma.reservation.create).mockResolvedValue({ id: 'reservation-1' } as any)
    vi.mocked(prisma.payment.create).mockResolvedValue({ id: 'payment-1' } as any)
    vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
      id: 'cs_123',
      client_secret: 'cs_secret_123',
    } as any)
    vi.mocked(stripe.paymentIntents.create).mockResolvedValue({
      id: 'pi_123',
      client_secret: 'pi_secret_123',
    } as any)
  })

  describe('default (embedded) mode', () => {
    it('still creates an embedded Checkout Session and no PaymentIntent', async () => {
      const response = await POST(bookingRequest(BASE_BODY))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.clientSecret).toBe('cs_secret_123')
      expect(data.mode).toBe('embedded')
      expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1)
      expect(stripe.paymentIntents.create).not.toHaveBeenCalled()
    })

    it('keeps charging the customer the full amount on the connected account', async () => {
      await POST(bookingRequest(BASE_BODY))

      const [params, options] = sessionCall()
      expect(params.ui_mode).toBe('embedded')
      expect(params.line_items?.[0].price_data?.unit_amount).toBe(AMOUNT_CENTS)
      expect(params.payment_intent_data?.application_fee_amount).toBe(
        Math.round(SUBTOTAL_CENTS * COMMISSION_RATE)
      )
      expect(options?.stripeAccount).toBe('acct_venue')
    })
  })

  describe('express mode', () => {
    it('creates a PaymentIntent instead of a Checkout Session', async () => {
      const response = await POST(bookingRequest({ ...BASE_BODY, mode: 'express' }))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.mode).toBe('express')
      expect(data.clientSecret).toBe('pi_secret_123')
      expect(data.paymentId).toBe('payment-1')
      expect(data.amountCents).toBe(AMOUNT_CENTS)
      expect(stripe.paymentIntents.create).toHaveBeenCalledTimes(1)
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled()
    })

    it('charges exactly what the embedded flow charges', async () => {
      await POST(bookingRequest({ ...BASE_BODY, mode: 'express' }))
      const [expressParams, expressOptions] = intentCall()

      vi.mocked(stripe.paymentIntents.create).mockClear()
      await POST(bookingRequest(BASE_BODY))
      const [sessionParams] = sessionCall()

      // The whole point of branching only at the Stripe call: the customer pays the
      // same total and Nooc takes the same commission either way.
      expect(expressParams.amount).toBe(sessionParams.line_items?.[0].price_data?.unit_amount)
      expect(expressParams.application_fee_amount).toBe(
        sessionParams.payment_intent_data?.application_fee_amount
      )
      expect(expressOptions?.stripeAccount).toBe('acct_venue')
    })

    it('tags the PaymentIntent so the webhook knows to finalize it', async () => {
      await POST(bookingRequest({ ...BASE_BODY, mode: 'express' }))
      const [params] = intentCall()

      expect(params.metadata).toMatchObject({
        flow: 'express',
        paymentId: 'payment-1',
        venueId: 'venue-1',
        userId: 'user-1',
      })
    })

    it('offers card only, so the fallback form stays bare card fields', async () => {
      await POST(bookingRequest({ ...BASE_BODY, mode: 'express' }))
      const [params] = intentCall()

      // Apple Pay and Google Pay ride on `card`, so they still appear as wallet buttons.
      // Widening this list is what brings Bank / Cash App / Klarna / Link clutter back,
      // which is the exact thing this flow exists to avoid.
      expect(params.payment_method_types).toEqual(['card'])
      expect(params.automatic_payment_methods).toBeUndefined()
    })

    it('records the PaymentIntent id on the payment row', async () => {
      await POST(bookingRequest({ ...BASE_BODY, mode: 'express' }))

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        data: { stripePaymentIntentId: 'pi_123' },
      })
    })

    it('creates the pending reservation up front, same as embedded', async () => {
      await POST(bookingRequest({ ...BASE_BODY, mode: 'express' }))

      expect(prisma.reservation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'pending', venueId: 'venue-1' }),
        })
      )
    })
  })

  describe('guards apply to both modes', () => {
    it.each(['express', undefined])('rejects signed-out users (mode=%s)', async (mode) => {
      vi.mocked(auth).mockResolvedValue(null as any)

      const response = await POST(bookingRequest(mode ? { ...BASE_BODY, mode } : BASE_BODY))

      expect(response.status).toBe(401)
      expect(stripe.paymentIntents.create).not.toHaveBeenCalled()
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled()
    })

    it.each(['express', undefined])(
      'rejects users who have not accepted terms (mode=%s)',
      async (mode) => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
          id: 'user-1',
          email: 'guest@example.com',
          termsAcceptedAt: null,
        } as any)

        const response = await POST(bookingRequest(mode ? { ...BASE_BODY, mode } : BASE_BODY))

        expect(response.status).toBe(403)
        expect(stripe.paymentIntents.create).not.toHaveBeenCalled()
        expect(stripe.checkout.sessions.create).not.toHaveBeenCalled()
      }
    )

    it.each(['express', undefined])(
      'refuses venues with no connected Stripe account (mode=%s)',
      async (mode) => {
        buildBookingContext.mockResolvedValue({
          venueId: 'venue-1',
          isGroupBooking: false,
          finalSeatIds: ['seat-1'],
          seats: [{ id: 'seat-1', tableId: 'table-1' }],
          parsedStart: new Date(BASE_BODY.startAt),
          parsedEnd: new Date(BASE_BODY.endAt),
          venue: { id: 'venue-1', name: 'Test Venue', stripeAccountId: null },
          table: null,
          requestedSeatCount: null,
        })

        const response = await POST(bookingRequest(mode ? { ...BASE_BODY, mode } : BASE_BODY))

        expect(response.status).toBe(400)
        expect(prisma.reservation.create).not.toHaveBeenCalled()
      }
    )

    it.each(['express', undefined])(
      'refuses a zero-amount booking (mode=%s)',
      async (mode) => {
        computeBookingPrice.mockReturnValue({
          subtotalCents: 0,
          processingFeeCents: 0,
          amountCents: 0,
        })

        const response = await POST(bookingRequest(mode ? { ...BASE_BODY, mode } : BASE_BODY))

        expect(response.status).toBe(400)
        expect(stripe.paymentIntents.create).not.toHaveBeenCalled()
        expect(stripe.checkout.sessions.create).not.toHaveBeenCalled()
      }
    )
  })
})
