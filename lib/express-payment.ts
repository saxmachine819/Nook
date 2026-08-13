import type Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { enqueueNotification } from '@/lib/notification-queue'

/**
 * Finalization for the express (PaymentIntent) checkout used on mobile.
 *
 * The embedded Checkout Session flow finalizes inside the `checkout.session.completed`
 * webhook case and is deliberately left alone — see `app/api/stripe/webhook/route.ts`.
 * Express payments are simpler: the route always creates the reservation up front, so
 * `payment.reservationId` is guaranteed to be set and there is no legacy
 * "rebuild the booking from bookingPayload" path to support.
 *
 * This function is safe to call more than once for the same PaymentIntent. Two callers
 * race it in normal operation:
 *   1. the `payment_intent.succeeded` webhook, and
 *   2. `/api/payments/express/status`, polled by the client after it confirms.
 * Whoever gets there first claims the payment with a conditional update; the loser
 * observes `already_finalized` and does nothing.
 */

export type FinalizeExpressPaymentResult =
  | { status: 'finalized'; reservationId: string }
  | { status: 'already_finalized'; reservationId: string | null }
  | { status: 'refunded'; reason: string }
  | { status: 'ignored'; reason: string }

/** Statuses a payment can legitimately move to PAID from. */
const CLAIMABLE_STATUSES = ['PENDING', 'FAILED'] as const

export async function finalizeExpressPayment(params: {
  paymentId: string
  paymentIntent: Stripe.PaymentIntent
  stripeAccount?: string | null
}): Promise<FinalizeExpressPaymentResult> {
  const { paymentIntent } = params

  if (paymentIntent.status !== 'succeeded') {
    return { status: 'ignored', reason: `PaymentIntent status is ${paymentIntent.status}` }
  }

  const payment = await prisma.payment.findUnique({ where: { id: params.paymentId } })
  if (!payment) {
    return { status: 'ignored', reason: 'Payment not found' }
  }
  if (!payment.userId) {
    return { status: 'ignored', reason: 'No userId on payment' }
  }
  if (!payment.reservationId) {
    return { status: 'ignored', reason: 'No reservationId on payment' }
  }

  const stripeAccount = params.stripeAccount || payment.stripeAccountId || undefined
  const { chargeId, applicationFeeId } = await resolveChargeIds(paymentIntent, stripeAccount)

  // Claim the payment. Exactly one caller sees count === 1; everyone else bails out
  // here, which is what keeps a racing webhook and status poll from both finalizing.
  const claim = await prisma.payment.updateMany({
    where: { id: payment.id, status: { in: [...CLAIMABLE_STATUSES] } },
    data: {
      status: 'PAID',
      paidAt: new Date(),
      stripePaymentIntentId: paymentIntent.id,
      stripeChargeId: chargeId ?? undefined,
      stripeApplicationFeeId: applicationFeeId ?? undefined,
    },
  })

  if (claim.count === 0) {
    return { status: 'already_finalized', reservationId: payment.reservationId }
  }

  const reservation = await prisma.reservation.findUnique({
    where: { id: payment.reservationId },
    include: {
      venue: {
        select: {
          name: true,
          timezone: true,
          ownerId: true,
          owner: { select: { email: true } },
        },
      },
    },
  })

  // The seat is gone (expired hold, cancelled, or an unexpected state). We are holding
  // the customer's money for a booking we cannot honor, so give it back.
  if (!reservation || (reservation.status !== 'pending' && reservation.status !== 'active')) {
    const reason = !reservation
      ? 'Reservation not found'
      : `Reservation status is ${reservation.status}`
    await refundExpressPayment({
      paymentId: payment.id,
      paymentIntentId: paymentIntent.id,
      applicationFeeId,
      stripeAccount,
    })
    return { status: 'refunded', reason }
  }

  if (reservation.status === 'pending') {
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: 'active' },
    })
  }

  await sendBookingNotifications({
    reservationId: reservation.id,
    venueId: reservation.venueId,
    userId: payment.userId,
    startAt: reservation.startAt,
    endAt: reservation.endAt,
    tableId: reservation.tableId,
    seatId: reservation.seatId,
    venueName: reservation.venue?.name ?? '',
    venueTimezone: reservation.venue?.timezone ?? undefined,
    venueOwnerId: reservation.venue?.ownerId ?? undefined,
    venueOwnerEmail: reservation.venue?.owner?.email ?? null,
  })

  return { status: 'finalized', reservationId: reservation.id }
}

async function resolveChargeIds(
  paymentIntent: Stripe.PaymentIntent,
  stripeAccount?: string
): Promise<{ chargeId: string | null; applicationFeeId: string | null }> {
  let chargeId: string | null = null
  let applicationFeeId: string | null = null

  const charge = paymentIntent.latest_charge
  if (typeof charge === 'string') {
    chargeId = charge
  } else if (charge) {
    chargeId = charge.id
    const appFee = charge.application_fee
    applicationFeeId = typeof appFee === 'string' ? appFee : (appFee?.id ?? null)
  }

  // The webhook payload carries latest_charge as a bare id, so the application fee has
  // to be fetched separately before we can refund it.
  if (chargeId && !applicationFeeId && stripeAccount) {
    try {
      const expanded = await stripe.charges.retrieve(chargeId, {}, { stripeAccount })
      const appFee = expanded.application_fee
      applicationFeeId = typeof appFee === 'string' ? appFee : (appFee?.id ?? null)
    } catch (err) {
      console.error('Failed to expand charge for application fee:', err)
    }
  }

  return { chargeId, applicationFeeId }
}

async function refundExpressPayment(params: {
  paymentId: string
  paymentIntentId: string
  applicationFeeId: string | null
  stripeAccount?: string
}) {
  try {
    if (params.stripeAccount) {
      await stripe.refunds.create(
        { payment_intent: params.paymentIntentId },
        { stripeAccount: params.stripeAccount }
      )
    }
    if (params.applicationFeeId) {
      await stripe.applicationFees.createRefund(params.applicationFeeId)
    }
    await prisma.payment.update({
      where: { id: params.paymentId },
      data: { status: 'REFUNDED' },
    })
  } catch (refundErr) {
    console.error('Failed to refund express payment:', refundErr)
  }
}

async function sendBookingNotifications(params: {
  reservationId: string
  venueId: string
  userId: string
  startAt: Date
  endAt: Date
  tableId: string | null
  seatId: string | null
  venueName: string
  venueTimezone?: string
  venueOwnerId?: string
  venueOwnerEmail: string | null
}) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? ''

  try {
    const userRecord = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { email: true },
    })

    if (userRecord?.email?.trim()) {
      await enqueueNotification({
        type: 'booking_confirmation',
        dedupeKey: `booking_confirmation:${params.reservationId}`,
        toEmail: userRecord.email.trim(),
        userId: params.userId,
        venueId: params.venueId,
        bookingId: params.reservationId,
        payload: {
          bookingId: params.reservationId,
          venueId: params.venueId,
          venueName: params.venueName,
          timeZone: params.venueTimezone,
          tableId: params.tableId,
          seatId: params.seatId,
          startAt: params.startAt.toISOString(),
          endAt: params.endAt.toISOString(),
          ...(baseUrl ? { confirmationUrl: `${baseUrl}/reservations/${params.reservationId}` } : {}),
        },
      })
    }

    if (params.venueOwnerEmail?.trim()) {
      await enqueueNotification({
        type: 'venue_booking_created',
        dedupeKey: `venue_booking_created:${params.reservationId}`,
        toEmail: params.venueOwnerEmail.trim(),
        userId: params.venueOwnerId,
        venueId: params.venueId,
        bookingId: params.reservationId,
        payload: {
          venueName: params.venueName,
          timeZone: params.venueTimezone,
          guestEmail: userRecord?.email ?? '',
          startAt: params.startAt.toISOString(),
          endAt: params.endAt.toISOString(),
        },
      })
    }
  } catch (emailError) {
    // Never let email trouble undo a successful payment — the booking is already active.
    console.error('[NON-CRITICAL] Express booking email enqueue failed', {
      error: emailError,
      reservationId: params.reservationId,
      userId: params.userId,
    })
  }
}
