import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { finalizeExpressPayment } from '@/lib/express-payment'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    webhookEvent: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    payment: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    reservation: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
    notificationEvent: { create: vi.fn() },
  },
}))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: { constructEvent: vi.fn() },
    paymentIntents: { retrieve: vi.fn() },
    refunds: { create: vi.fn() },
    applicationFees: { createRefund: vi.fn() },
  },
}))

vi.mock('@/lib/booking', () => ({
  buildBookingContext: vi.fn(),
  createReservationFromContext: vi.fn(),
  computeBookingPrice: vi.fn().mockReturnValue({ amountCents: 340 }),
}))

vi.mock('@/lib/notification-queue', () => ({
  enqueueNotification: vi.fn().mockResolvedValue({ created: true, id: 'n1' }),
}))

vi.mock('@/lib/express-payment', () => ({
  finalizeExpressPayment: vi.fn().mockResolvedValue({
    status: 'finalized',
    reservationId: 'reservation-1',
  }),
}))

const { POST } = await import('@/app/api/stripe/webhook/route')

function webhookRequest() {
  return new NextRequest('http://localhost:3000/api/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 'sig_test' },
    body: '{}',
  })
}

function paymentIntentEvent(metadata: Record<string, string>) {
  return {
    id: `evt_${Math.random().toString(36).slice(2)}`,
    type: 'payment_intent.succeeded',
    account: 'acct_venue',
    data: {
      object: {
        id: 'pi_123',
        status: 'succeeded',
        latest_charge: 'ch_123',
        metadata,
      },
    },
  }
}

describe('Stripe webhook — payment_intent.succeeded', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.webhookEvent.upsert).mockResolvedValue({} as any)
    vi.mocked(prisma.webhookEvent.update).mockResolvedValue({} as any)
    vi.mocked(finalizeExpressPayment).mockResolvedValue({
      status: 'finalized',
      reservationId: 'reservation-1',
    })
  })

  it('finalizes an express payment', async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
      paymentIntentEvent({ flow: 'express', paymentId: 'payment-1' }) as any
    )

    const response = await POST(webhookRequest())

    expect(response.status).toBe(200)
    expect(finalizeExpressPayment).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: 'payment-1', stripeAccount: 'acct_venue' })
    )
  })

  it('ignores PaymentIntents from the embedded Checkout flow', async () => {
    // Embedded Checkout produces a PaymentIntent too, but it is finalized by
    // checkout.session.completed. Touching it here would double-process the booking.
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
      paymentIntentEvent({ paymentId: 'payment-1' }) as any
    )

    const response = await POST(webhookRequest())

    expect(response.status).toBe(200)
    expect(finalizeExpressPayment).not.toHaveBeenCalled()
  })

  it('ignores an express PaymentIntent with no paymentId in metadata', async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
      paymentIntentEvent({ flow: 'express' }) as any
    )

    const response = await POST(webhookRequest())

    expect(response.status).toBe(200)
    expect(finalizeExpressPayment).not.toHaveBeenCalled()
  })

  it('acknowledges the event when the payment was already finalized', async () => {
    vi.mocked(finalizeExpressPayment).mockResolvedValue({
      status: 'already_finalized',
      reservationId: 'reservation-1',
    })
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
      paymentIntentEvent({ flow: 'express', paymentId: 'payment-1' }) as any
    )

    const response = await POST(webhookRequest())

    // A 500 here would make Stripe retry forever over a payment that is already done.
    expect(response.status).toBe(200)
    expect(prisma.webhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ processed: true }),
      })
    )
  })

  it('skips events it has already processed', async () => {
    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue({ processed: true } as any)
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
      paymentIntentEvent({ flow: 'express', paymentId: 'payment-1' }) as any
    )

    const response = await POST(webhookRequest())

    expect(response.status).toBe(200)
    expect(finalizeExpressPayment).not.toHaveBeenCalled()
  })
})
