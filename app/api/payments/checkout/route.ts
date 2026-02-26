import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildBookingContext, computeBookingPrice } from '@/lib/booking'
import { stripe } from '@/lib/stripe'

export const runtime = 'nodejs'

/** Nook's platform commission: 20% of the booking subtotal */
const COMMISSION_RATE = 0.2

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    const userRecord = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, termsAcceptedAt: true },
    })

    if (!userRecord) {
      return NextResponse.json(
        { error: 'User account not found. Please sign out and sign in again.' },
        { status: 401 }
      )
    }

    if (!userRecord.termsAcceptedAt) {
      return NextResponse.json(
        { error: 'You must accept the Terms & Conditions to make a reservation.' },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))

    let context: Awaited<ReturnType<typeof buildBookingContext>>
    try {
      context = await buildBookingContext(body, session.user.id)
    } catch (err: any) {
      const status = err?.status ?? 400
      const code = err?.code
      return NextResponse.json(
        { error: err?.message || 'Failed to prepare checkout.', ...(code ? { code } : {}) },
        { status }
      )
    }

    if (!context.venue?.stripeAccountId) {
      return NextResponse.json(
        { error: 'This venue is not connected to Stripe yet.' },
        { status: 400 }
      )
    }

    const pricing = computeBookingPrice(context)
    if (pricing.amountCents <= 0) {
      return NextResponse.json(
        { error: 'Unable to calculate a valid payment amount.' },
        { status: 400 }
      )
    }

    // Application fee = Nooc's 20% commission on the subtotal only.
    // The customer pays subtotal + processing fee; the full charge goes to the venue's Stripe account.
    // Stripe deducts their fee from the venue's side; we take only 20% so the venue keeps 80% of the subtotal.
    // Example: $3 subtotal → customer pays $3.40 → Stripe deducts ~$0.40 → venue has $3.00 → we take $0.60 → venue gets $2.40 (80%).
    const nookCommission = Math.round(pricing.subtotalCents * COMMISSION_RATE)
    const applicationFeeAmount = Math.max(0, Math.min(pricing.amountCents, nookCommission))

    // Create reservation first (with pending status until payment completes)
    const firstSeat = context.seats[0]
    const reservation = await prisma.reservation.create({
      data: {
        venueId: context.venueId,
        tableId: context.isGroupBooking ? context.tableId : (firstSeat?.tableId ?? null),
        seatId: context.isGroupBooking ? null : (firstSeat?.id ?? null),
        userId: session.user.id,
        startAt: context.parsedStart,
        endAt: context.parsedEnd,
        pendingExpiresAt: new Date(Date.now() + 3 * 60 * 1000),
        seatCount: context.isGroupBooking
          ? (context.requestedSeatCount ?? context.table?.seatCount ?? 1)
          : context.finalSeatIds.length,
        status: 'pending',
      },
    })

    const payment = await prisma.payment.create({
      data: {
        venueId: context.venueId,
        userId: session.user.id,
        reservationId: reservation.id,
        amount: pricing.amountCents,
        currency: 'usd',
        applicationFeeAmount,
        stripeAccountId: context.venue?.stripeAccountId ?? null,
        bookingPayload: body,
      },
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || ''
    if (!appUrl) {
      return NextResponse.json(
        { error: 'Missing NEXT_PUBLIC_APP_URL for Stripe redirects.' },
        { status: 500 }
      )
    }

    const sessionResponse = await stripe.checkout.sessions.create(
      {
        ui_mode: 'embedded',
        mode: 'payment',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: pricing.amountCents,
              product_data: {
                name: `Reservation at ${context.venue?.name ?? 'Venue'}`,
                description: context.isGroupBooking
                  ? `Group table reservation (includes 3% processing fee)`
                  : `Seat reservation (includes 3% processing fee)`,
              },
            },
          },
        ],
        return_url: `${appUrl.replace(/\/$/, '')}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
        customer_email: userRecord.email ?? undefined,
        metadata: {
          paymentId: payment.id,
          venueId: context.venueId,
          userId: session.user.id,
        },
        payment_intent_data: {
          application_fee_amount: applicationFeeAmount,
          metadata: {
            paymentId: payment.id,
            venueId: context.venueId,
            userId: session.user.id,
          },
        },
      },
      {
        stripeAccount: context.venue?.stripeAccountId ?? undefined,
      }
    )

    await prisma.payment.update({
      where: { id: payment.id },
      data: { stripeCheckoutSessionId: sessionResponse.id },
    })

    return NextResponse.json({
      clientSecret: sessionResponse.client_secret,
      stripeAccountId: context.venue?.stripeAccountId,
    })
  } catch (error) {
    console.error('POST /api/payments/checkout:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to start checkout.'
    const errorDetails = error instanceof Error ? error.stack : String(error)
    console.error('Error details:', errorDetails)
    return NextResponse.json(
      {
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined,
      },
      { status: 500 }
    )
  }
}
