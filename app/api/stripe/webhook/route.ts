import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import { buildBookingContext, computeBookingPrice, createReservationFromContext } from "@/lib/booking"
import { enqueueNotification } from "@/lib/notification-queue"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 })
  }

  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 })
  }

  const payload = await request.text()

  let event
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const paymentId = session.metadata?.paymentId
        if (!paymentId) break

        const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
        if (!payment) break

        if (payment.status === "PAID" && payment.reservationId) break
        if (!payment.userId) break

        const stripeAccount = event.account || payment.stripeAccountId || undefined
        const paymentIntentId = session.payment_intent as string | null

        let chargeId: string | null = null
        let applicationFeeId: string | null = null
        if (paymentIntentId && stripeAccount) {
          const paymentIntent = await stripe.paymentIntents.retrieve(
            paymentIntentId,
            { expand: ["latest_charge"] },
            { stripeAccount }
          )
          const charge = paymentIntent.latest_charge
          if (typeof charge === "object" && charge) {
            chargeId = charge.id ?? null
            const appFee = charge.application_fee
            applicationFeeId =
              typeof appFee === "string" ? appFee : appFee?.id ?? null
          } else if (typeof charge === "string") {
            chargeId = charge
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

        try {
          const bookingPayload = payment.bookingPayload as any
          const userId = payment.userId
          const context = await buildBookingContext(bookingPayload, userId)
          const reservation = await createReservationFromContext(context, userId)
          const pricing = computeBookingPrice(context)

          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: "PAID",
              reservationId: reservation.id,
              amount: pricing.amountCents,
            },
          })

          const userRecord = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true },
          })

          if (userRecord?.email?.trim()) {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? ""
            await enqueueNotification({
              type: "booking_confirmation",
              dedupeKey: `booking_confirmation:${reservation.id}`,
              toEmail: userRecord.email.trim(),
              userId,
              venueId: reservation.venueId,
              bookingId: reservation.id,
              payload: {
                bookingId: reservation.id,
                venueId: reservation.venueId,
                venueName: reservation.venue?.name ?? "",
                timeZone: reservation.venue?.timezone ?? undefined,
                tableId: reservation.tableId ?? null,
                seatId: reservation.seatId ?? null,
                startAt: reservation.startAt.toISOString(),
                endAt: reservation.endAt.toISOString(),
                ...(baseUrl ? { confirmationUrl: `${baseUrl}/reservations/${reservation.id}` } : {}),
              },
            })
          }

          if (reservation.venue?.owner?.email?.trim()) {
            await enqueueNotification({
              type: "venue_booking_created",
              dedupeKey: `venue_booking_created:${reservation.id}`,
              toEmail: reservation.venue.owner.email.trim(),
              userId: reservation.venue.ownerId ?? undefined,
              venueId: reservation.venueId,
              bookingId: reservation.id,
              payload: {
                venueName: reservation.venue?.name ?? "",
                timeZone: reservation.venue?.timezone ?? undefined,
                guestEmail: userRecord?.email ?? "",
                startAt: reservation.startAt.toISOString(),
                endAt: reservation.endAt.toISOString(),
              },
            })
          }
        } catch (err) {
          console.error("Failed to finalize reservation after checkout:", err)

          if (paymentIntentId && stripeAccount) {
            await stripe.refunds.create(
              {
                payment_intent: paymentIntentId,
              },
              { stripeAccount }
            )
          }

          if (applicationFeeId) {
            await stripe.applicationFees.createRefund(applicationFeeId)
          }

          await prisma.payment.update({
            where: { id: payment.id },
            data: { status: "REFUNDED" },
          })
        }
        break
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session
        const paymentId = session.metadata?.paymentId
        if (!paymentId) break
        await prisma.payment.update({
          where: { id: paymentId },
          data: { status: "CANCELED" },
        })
        break
      }
      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent
        const paymentId = intent.metadata?.paymentId
        if (!paymentId) break
        await prisma.payment.update({
          where: { id: paymentId },
          data: { status: "FAILED" },
        })
        break
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge
        const paymentIntentId = charge.payment_intent as string | null
        if (!paymentIntentId) break
        const payment = await prisma.payment.findUnique({
          where: { stripePaymentIntentId: paymentIntentId },
        })
        if (!payment) break
        const refunded = charge.amount_refunded ?? 0
        const isFull = refunded >= payment.amount
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            amountRefunded: refunded,
            status: isFull ? "REFUNDED" : "PARTIALLY_REFUNDED",
          },
        })
        break
      }
      default:
        break
    }
  } catch (err) {
    console.error("Stripe webhook error:", err)
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
