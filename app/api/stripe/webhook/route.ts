import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import {
  buildBookingContext,
  computeBookingPrice,
  createReservationFromContext,
} from '@/lib/booking'
import { enqueueNotification } from '@/lib/notification-queue'
import type { Prisma } from '@prisma/client'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Missing STRIPE_WEBHOOK_SECRET' }, { status: 500 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 })
  }

  const payload = await request.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const existingEvent = await prisma.webhookEvent.findUnique({
    where: { stripeEventId: event.id },
  })

  if (existingEvent?.processed) {
    console.log('[DUPLICATE_WEBHOOK]', { eventId: event.id })
    return NextResponse.json({ received: true })
  }

  await prisma.webhookEvent.upsert({
    where: { stripeEventId: event.id },
    update: {
      processed: false,
      payload: event.data.object as unknown as Prisma.InputJsonValue,
    },
    create: {
      stripeEventId: event.id,
      eventType: event.type,
      processed: false,
      payload: event.data.object as unknown as Prisma.InputJsonValue,
      account: event.account || null,
    },
  })

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const paymentId = session.metadata?.paymentId
        if (!paymentId) {
          await markEventProcessed(event.id, 'Missing paymentId in metadata')
          break
        }

        const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
        if (!payment) {
          await markEventProcessed(event.id, 'Payment not found')
          break
        }

        if (payment.status === 'PAID' && payment.reservationId) {
          await markEventProcessed(event.id, 'Payment already processed')
          break
        }

        if (!payment.userId) {
          await markEventProcessed(event.id, 'No userId on payment')
          break
        }

        const userId = payment.userId
        const stripeAccount = event.account || payment.stripeAccountId || undefined
        const paymentIntentId = session.payment_intent as string | null

        let chargeId: string | null = null
        let applicationFeeId: string | null = null
        if (paymentIntentId && stripeAccount) {
          try {
            const paymentIntent = await stripe.paymentIntents.retrieve(
              paymentIntentId,
              { expand: ['latest_charge'] },
              { stripeAccount }
            )
            const charge = paymentIntent.latest_charge
            if (typeof charge === 'string') {
              chargeId = charge
            } else if (charge) {
              chargeId = charge.id
              const appFee = charge.application_fee
              applicationFeeId = typeof appFee === 'string' ? appFee : (appFee?.id ?? null)
            }
          } catch (err) {
            console.error('Failed to retrieve payment intent:', err)
          }
        }

        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            stripeCheckoutSessionId: session.id,
            stripePaymentIntentId: paymentIntentId ?? undefined,
            stripeChargeId: chargeId ?? undefined,
            stripeApplicationFeeId: applicationFeeId ?? undefined,
          },
        })

        let reservation = payment.reservationId
          ? await prisma.reservation.findUnique({
              where: { id: payment.reservationId },
              include: {
                venue: {
                  include: {
                    tables: { include: { seats: true } },
                    owner: { select: { email: true } },
                  },
                },
              },
            })
          : null

        try {
          if (reservation) {
            // Finalize existing pending reservation
            await prisma.reservation.update({
              where: { id: reservation.id },
              data: { status: 'active' },
            })
          } else {
            // Fallback for legacy payments without reservationId
            const bookingPayload = payment.bookingPayload as Record<string, unknown>
            const context = await buildBookingContext(bookingPayload, userId)
            reservation = (await createReservationFromContext(context, userId)) as any
          }

          if (!reservation) {
            throw new Error('Failed to identify or create reservation')
          }

          const bookingPayload = payment.bookingPayload as Record<string, unknown>
          const context = await buildBookingContext(bookingPayload, userId)
          const pricing = computeBookingPrice(context)

          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: 'PAID',
              reservationId: reservation.id,
              amount: pricing.amountCents,
              paidAt: new Date(),
            },
          })
        } catch (err) {
          console.error('Failed to finalize reservation after checkout:', err)

          try {
            if (paymentIntentId && stripeAccount) {
              await stripe.refunds.create({ payment_intent: paymentIntentId }, { stripeAccount })
            }

            if (applicationFeeId) {
              await stripe.applicationFees.createRefund(applicationFeeId)
            }
          } catch (refundErr) {
            console.error('Failed to process refund:', refundErr)
          }

          await prisma.payment.update({
            where: { id: payment.id },
            data: { status: 'REFUNDED' },
          })

          await markEventProcessed(
            event.id,
            `Reservation creation failed: ${err instanceof Error ? err.message : 'Unknown error'}`
          )
          break
        }

        const userRecord = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true },
        })

        try {
          if (userRecord?.email?.trim()) {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? ''
            await enqueueNotification({
              type: 'booking_confirmation',
              dedupeKey: `booking_confirmation:${reservation.id}`,
              toEmail: userRecord.email.trim(),
              userId,
              venueId: reservation.venueId,
              bookingId: reservation.id,
              payload: {
                bookingId: reservation.id,
                venueId: reservation.venueId,
                venueName: reservation.venue?.name ?? '',
                timeZone: reservation.venue?.timezone ?? undefined,
                tableId: reservation.tableId ?? null,
                seatId: reservation.seatId ?? null,
                startAt: reservation.startAt.toISOString(),
                endAt: reservation.endAt.toISOString(),
                ...(baseUrl
                  ? { confirmationUrl: `${baseUrl}/reservations/${reservation.id}` }
                  : {}),
              },
            })
          }

          if (reservation.venue?.owner?.email?.trim()) {
            await enqueueNotification({
              type: 'venue_booking_created',
              dedupeKey: `venue_booking_created:${reservation.id}`,
              toEmail: reservation.venue.owner.email.trim(),
              userId: reservation.venue.ownerId ?? undefined,
              venueId: reservation.venueId,
              bookingId: reservation.id,
              payload: {
                venueName: reservation.venue?.name ?? '',
                timeZone: reservation.venue?.timezone ?? undefined,
                guestEmail: userRecord?.email ?? '',
                startAt: reservation.startAt.toISOString(),
                endAt: reservation.endAt.toISOString(),
              },
            })
          }
        } catch (emailError) {
          console.error('[NON-CRITICAL] Email delivery failed', {
            error: emailError,
            reservationId: reservation.id,
            userId,
          })

          await prisma.notificationEvent.create({
            data: {
              type: 'booking_confirmation',
              status: 'FAILED',
              dedupeKey: `booking_confirmation:${reservation.id}`,
              toEmail: userRecord?.email ?? '',
              userId,
              venueId: reservation.venueId,
              bookingId: reservation.id,
              payload: {},
              error: emailError instanceof Error ? emailError.message : 'Unknown error',
            },
          })
        }

        await markEventProcessed(event.id)
        break
      }
      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session
        const paymentId = session.metadata?.paymentId
        if (!paymentId) {
          await markEventProcessed(event.id, 'Missing paymentId in metadata')
          break
        }
        await prisma.payment.update({
          where: { id: paymentId },
          data: { status: 'CANCELED' },
        })
        await markEventProcessed(event.id)
        break
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent
        const paymentId = intent.metadata?.paymentId
        if (!paymentId) {
          await markEventProcessed(event.id, 'Missing paymentId in metadata')
          break
        }
        await prisma.payment.update({
          where: { id: paymentId },
          data: { status: 'FAILED' },
        })
        await markEventProcessed(event.id)
        break
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        const paymentIntentId = charge.payment_intent as string | null
        if (!paymentIntentId) {
          await markEventProcessed(event.id, 'Missing payment_intent')
          break
        }
        const payment = await prisma.payment.findUnique({
          where: { stripePaymentIntentId: paymentIntentId },
        })
        if (!payment) {
          await markEventProcessed(event.id, 'Payment not found')
          break
        }
        const refunded = charge.amount_refunded ?? 0
        const isFull = refunded >= payment.amount
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            amountRefunded: refunded,
            status: isFull ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          },
        })
        await markEventProcessed(event.id)
        break
      }
      default:
        await markEventProcessed(event.id)
    }
  } catch (err) {
    console.error('Stripe webhook error:', err)
    await prisma.webhookEvent.update({
      where: { stripeEventId: event.id },
      data: {
        error: err instanceof Error ? err.message : 'Unknown error',
        processedAt: new Date(),
      },
    })
    return NextResponse.json({ error: 'Webhook handler failed.' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function markEventProcessed(eventId: string, error?: string) {
  await prisma.webhookEvent.update({
    where: { stripeEventId: eventId },
    data: {
      processed: true,
      processedAt: new Date(),
      error: error ?? null,
    },
  })
}
