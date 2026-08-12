import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from '@/app/api/stripe/webhook/route'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    webhookEvent: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    payment: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    reservation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    notificationEvent: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
    paymentIntents: {
      retrieve: vi.fn(),
    },
    refunds: {
      create: vi.fn(),
    },
    applicationFees: {
      createRefund: vi.fn(),
    },
  },
}))

vi.mock('@/lib/booking', () => ({
  buildBookingContext: vi.fn(),
  createReservationFromContext: vi.fn(),
  computeBookingPrice: vi.fn().mockReturnValue({ amountCents: 1000 }),
}))

vi.mock('@/lib/notification-queue', () => ({
  enqueueNotification: vi.fn().mockResolvedValue(true),
}))

describe('Stripe Webhook Fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
  })

  it('should finalize existing reservation instead of creating a new one', async () => {
    const mockEvent = {
      id: 'evt_123',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_123',
          metadata: { paymentId: 'pay_123' },
          payment_intent: 'pi_123',
        },
      },
    }

    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as any)
    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      id: 'pay_123',
      userId: 'user_123',
      reservationId: 'res_123',
      amount: 1000,
      bookingPayload: {},
    } as any)
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 'res_123',
      venueId: 'venue_123',
      status: 'pending',
    } as any)

    const request = new NextRequest('http://localhost/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_123' },
      body: JSON.stringify(mockEvent),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    // Verify reservation was updated, not created
    expect(prisma.reservation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'res_123' },
        data: { status: 'active' },
      })
    )
    const { createReservationFromContext } = await import('@/lib/booking')
    expect(createReservationFromContext).not.toHaveBeenCalled()
  })

  describe('refund-safety branches when the reservation is not in a bookable state', () => {
    const mockEvent = {
      id: 'evt_refund_safety',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_refund_safety',
          metadata: { paymentId: 'pay_refund_safety' },
          payment_intent: 'pi_refund_safety',
        },
      },
    }

    beforeEach(() => {
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as any)
      vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.payment.findUnique).mockResolvedValue({
        id: 'pay_refund_safety',
        userId: 'user_123',
        reservationId: 'res_refund_safety',
        amount: 1000,
        bookingPayload: {},
        stripeAccountId: 'acct_123',
      } as any)
      vi.mocked(stripe.paymentIntents.retrieve).mockResolvedValue({
        latest_charge: { id: 'ch_123', application_fee: 'fee_123' },
      } as any)
    })

    async function postEvent() {
      const request = new NextRequest('http://localhost/api/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 'sig_refund_safety' },
        body: JSON.stringify(mockEvent),
      })
      return POST(request)
    }

    it('refunds instead of finalizing when the reservation no longer exists', async () => {
      vi.mocked(prisma.reservation.findUnique).mockResolvedValue(null)

      const response = await postEvent()
      expect(response.status).toBe(200)

      expect(stripe.refunds.create).toHaveBeenCalledWith(
        { payment_intent: 'pi_refund_safety' },
        { stripeAccount: 'acct_123' }
      )
      expect(stripe.applicationFees.createRefund).toHaveBeenCalledWith('fee_123')
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay_refund_safety' },
          data: { status: 'REFUNDED' },
        })
      )
      expect(prisma.reservation.update).not.toHaveBeenCalled()
    })

    it('refunds instead of finalizing when the reservation was cancelled', async () => {
      vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
        id: 'res_refund_safety',
        status: 'cancelled',
      } as any)

      const response = await postEvent()
      expect(response.status).toBe(200)

      expect(stripe.refunds.create).toHaveBeenCalledWith(
        { payment_intent: 'pi_refund_safety' },
        { stripeAccount: 'acct_123' }
      )
      expect(stripe.applicationFees.createRefund).toHaveBeenCalledWith('fee_123')
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay_refund_safety' },
          data: { status: 'REFUNDED' },
        })
      )
      expect(prisma.reservation.update).not.toHaveBeenCalled()
    })

    it('refunds instead of finalizing when the reservation is in an unexpected status', async () => {
      // Neither 'pending'/'active' (finalize) nor 'cancelled' (missing-reservation path) —
      // e.g. already 'completed' by some other process.
      vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
        id: 'res_refund_safety',
        status: 'completed',
      } as any)

      const response = await postEvent()
      expect(response.status).toBe(200)

      expect(stripe.refunds.create).toHaveBeenCalledWith(
        { payment_intent: 'pi_refund_safety' },
        { stripeAccount: 'acct_123' }
      )
      expect(stripe.applicationFees.createRefund).toHaveBeenCalledWith('fee_123')
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay_refund_safety' },
          data: { status: 'REFUNDED' },
        })
      )
      expect(prisma.reservation.update).not.toHaveBeenCalled()
    })
  })

  it('should cancel payment on checkout.session.expired', async () => {
    const mockEvent = {
      id: 'evt_expired',
      type: 'checkout.session.expired',
      data: {
        object: {
          id: 'cs_expired',
          metadata: { paymentId: 'pay_expired' },
        },
      },
    }

    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as any)
    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_expired' },
      body: JSON.stringify(mockEvent),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay_expired' },
        data: { status: 'CANCELED' },
      })
    )
  })

  it('should mark payment as failed on payment_intent.payment_failed', async () => {
    const mockEvent = {
      id: 'evt_failed',
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_failed',
          metadata: { paymentId: 'pay_failed' },
        },
      },
    }

    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as any)
    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_failed' },
      body: JSON.stringify(mockEvent),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay_failed' },
        data: { status: 'FAILED' },
      })
    )
  })

  it('should update payment on charge.refunded', async () => {
    const mockEvent = {
      id: 'evt_refunded',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_refunded',
          payment_intent: 'pi_refunded',
          amount_refunded: 1000,
        },
      },
    }

    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as any)
    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      id: 'pay_refunded',
      amount: 1000,
    } as any)

    const request = new NextRequest('http://localhost/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_refunded' },
      body: JSON.stringify(mockEvent),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay_refunded' },
        data: {
          amountRefunded: 1000,
          status: 'REFUNDED',
        },
      })
    )
  })

  it('should handle duplicate webhooks gracefully', async () => {
    const mockEvent = {
      id: 'evt_duplicate',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_duplicate',
          metadata: { paymentId: 'pay_duplicate' },
        },
      },
    }

    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as any)
    // First call: findUnique returns a processed event
    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue({
      stripeEventId: 'evt_duplicate',
      processed: true,
    } as any)

    const request = new NextRequest('http://localhost/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_duplicate' },
      body: JSON.stringify(mockEvent),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json).toEqual({ received: true })

    // Verify no further processing occurred
    expect(prisma.webhookEvent.upsert).not.toHaveBeenCalled()
    expect(prisma.payment.findUnique).not.toHaveBeenCalled()
  })
})
