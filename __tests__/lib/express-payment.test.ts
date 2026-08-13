import { describe, it, expect, beforeEach, vi } from 'vitest'
import { finalizeExpressPayment } from '@/lib/express-payment'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { enqueueNotification } from '@/lib/notification-queue'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    payment: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    reservation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    charges: { retrieve: vi.fn() },
    refunds: { create: vi.fn() },
    applicationFees: { createRefund: vi.fn() },
  },
}))

vi.mock('@/lib/notification-queue', () => ({
  enqueueNotification: vi.fn().mockResolvedValue({ created: true, id: 'notif-1' }),
}))

const PAYMENT_ID = 'payment-1'
const RESERVATION_ID = 'reservation-1'
const STRIPE_ACCOUNT = 'acct_venue'

function succeededIntent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pi_123',
    status: 'succeeded',
    latest_charge: { id: 'ch_123', application_fee: 'fee_123' },
    metadata: { paymentId: PAYMENT_ID, flow: 'express' },
    ...overrides,
  } as any
}

function mockPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: PAYMENT_ID,
    userId: 'user-1',
    reservationId: RESERVATION_ID,
    status: 'PENDING',
    amount: 340,
    stripeAccountId: STRIPE_ACCOUNT,
    ...overrides,
  } as any
}

function mockReservation(overrides: Record<string, unknown> = {}) {
  return {
    id: RESERVATION_ID,
    venueId: 'venue-1',
    status: 'pending',
    startAt: new Date('2026-09-01T15:00:00Z'),
    endAt: new Date('2026-09-01T17:00:00Z'),
    tableId: null,
    seatId: 'seat-1',
    venue: {
      name: 'Test Venue',
      timezone: 'America/New_York',
      ownerId: 'owner-1',
      owner: { email: 'owner@example.com' },
    },
    ...overrides,
  } as any
}

describe('finalizeExpressPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ email: 'guest@example.com' } as any)
  })

  it('activates the reservation and marks the payment paid', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(mockPayment())
    vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 1 } as any)
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(mockReservation())

    const result = await finalizeExpressPayment({
      paymentId: PAYMENT_ID,
      paymentIntent: succeededIntent(),
      stripeAccount: STRIPE_ACCOUNT,
    })

    expect(result).toEqual({ status: 'finalized', reservationId: RESERVATION_ID })
    expect(prisma.reservation.update).toHaveBeenCalledWith({
      where: { id: RESERVATION_ID },
      data: { status: 'active' },
    })
    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PAID',
          stripePaymentIntentId: 'pi_123',
          stripeChargeId: 'ch_123',
          stripeApplicationFeeId: 'fee_123',
        }),
      })
    )
  })

  it('only claims a payment that has not already been paid', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(mockPayment())
    vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 1 } as any)
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(mockReservation())

    await finalizeExpressPayment({
      paymentId: PAYMENT_ID,
      paymentIntent: succeededIntent(),
      stripeAccount: STRIPE_ACCOUNT,
    })

    // The status filter is what makes concurrent callers safe — without it, a racing
    // webhook and status poll would both proceed to activate and email.
    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PAYMENT_ID, status: { in: ['PENDING', 'FAILED'] } },
      })
    )
  })

  it('is a no-op when another caller already finalized the payment', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(mockPayment())
    // Zero rows updated = someone else won the claim.
    vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 0 } as any)

    const result = await finalizeExpressPayment({
      paymentId: PAYMENT_ID,
      paymentIntent: succeededIntent(),
      stripeAccount: STRIPE_ACCOUNT,
    })

    expect(result).toEqual({ status: 'already_finalized', reservationId: RESERVATION_ID })
    expect(prisma.reservation.update).not.toHaveBeenCalled()
    expect(enqueueNotification).not.toHaveBeenCalled()
  })

  it('enqueues guest and venue emails exactly once', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(mockPayment())
    vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 1 } as any)
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(mockReservation())

    await finalizeExpressPayment({
      paymentId: PAYMENT_ID,
      paymentIntent: succeededIntent(),
      stripeAccount: STRIPE_ACCOUNT,
    })

    expect(enqueueNotification).toHaveBeenCalledTimes(2)
    expect(enqueueNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'booking_confirmation',
        dedupeKey: `booking_confirmation:${RESERVATION_ID}`,
        toEmail: 'guest@example.com',
      })
    )
    expect(enqueueNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'venue_booking_created',
        dedupeKey: `venue_booking_created:${RESERVATION_ID}`,
        toEmail: 'owner@example.com',
      })
    )
  })

  it('leaves an already-active reservation alone but still marks the payment paid', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(mockPayment())
    vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 1 } as any)
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(
      mockReservation({ status: 'active' })
    )

    const result = await finalizeExpressPayment({
      paymentId: PAYMENT_ID,
      paymentIntent: succeededIntent(),
      stripeAccount: STRIPE_ACCOUNT,
    })

    expect(result).toEqual({ status: 'finalized', reservationId: RESERVATION_ID })
    expect(prisma.reservation.update).not.toHaveBeenCalled()
  })

  it('refunds the customer and the application fee when the reservation is gone', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(mockPayment())
    vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 1 } as any)
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(null)

    const result = await finalizeExpressPayment({
      paymentId: PAYMENT_ID,
      paymentIntent: succeededIntent(),
      stripeAccount: STRIPE_ACCOUNT,
    })

    expect(result).toEqual({ status: 'refunded', reason: 'Reservation not found' })
    expect(stripe.refunds.create).toHaveBeenCalledWith(
      { payment_intent: 'pi_123' },
      { stripeAccount: STRIPE_ACCOUNT }
    )
    expect(stripe.applicationFees.createRefund).toHaveBeenCalledWith('fee_123')
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: PAYMENT_ID },
      data: { status: 'REFUNDED' },
    })
    expect(enqueueNotification).not.toHaveBeenCalled()
  })

  it('refunds when the reservation was cancelled while the customer was paying', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(mockPayment())
    vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 1 } as any)
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(
      mockReservation({ status: 'cancelled' })
    )

    const result = await finalizeExpressPayment({
      paymentId: PAYMENT_ID,
      paymentIntent: succeededIntent(),
      stripeAccount: STRIPE_ACCOUNT,
    })

    expect(result).toEqual({ status: 'refunded', reason: 'Reservation status is cancelled' })
    expect(stripe.refunds.create).toHaveBeenCalled()
  })

  it('fetches the application fee when the webhook sends latest_charge as a bare id', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(mockPayment())
    vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 1 } as any)
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(mockReservation())
    vi.mocked(stripe.charges.retrieve).mockResolvedValue({
      id: 'ch_123',
      application_fee: 'fee_from_expand',
    } as any)

    await finalizeExpressPayment({
      paymentId: PAYMENT_ID,
      paymentIntent: succeededIntent({ latest_charge: 'ch_123' }),
      stripeAccount: STRIPE_ACCOUNT,
    })

    expect(stripe.charges.retrieve).toHaveBeenCalledWith(
      'ch_123',
      {},
      { stripeAccount: STRIPE_ACCOUNT }
    )
    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ stripeApplicationFeeId: 'fee_from_expand' }),
      })
    )
  })

  it('ignores a PaymentIntent that has not succeeded', async () => {
    const result = await finalizeExpressPayment({
      paymentId: PAYMENT_ID,
      paymentIntent: succeededIntent({ status: 'requires_payment_method' }),
      stripeAccount: STRIPE_ACCOUNT,
    })

    expect(result).toEqual({
      status: 'ignored',
      reason: 'PaymentIntent status is requires_payment_method',
    })
    expect(prisma.payment.updateMany).not.toHaveBeenCalled()
  })

  it('ignores a payment with no reservation attached', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(
      mockPayment({ reservationId: null })
    )

    const result = await finalizeExpressPayment({
      paymentId: PAYMENT_ID,
      paymentIntent: succeededIntent(),
      stripeAccount: STRIPE_ACCOUNT,
    })

    expect(result).toEqual({ status: 'ignored', reason: 'No reservationId on payment' })
    expect(prisma.payment.updateMany).not.toHaveBeenCalled()
  })

  it('does not fail the booking when email enqueue throws', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(mockPayment())
    vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 1 } as any)
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(mockReservation())
    vi.mocked(enqueueNotification).mockRejectedValueOnce(new Error('resend is down'))

    const result = await finalizeExpressPayment({
      paymentId: PAYMENT_ID,
      paymentIntent: succeededIntent(),
      stripeAccount: STRIPE_ACCOUNT,
    })

    // The money moved and the seat is held — an email outage must not undo that.
    expect(result).toEqual({ status: 'finalized', reservationId: RESERVATION_ID })
  })
})
