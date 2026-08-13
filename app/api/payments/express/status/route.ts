import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { finalizeExpressPayment } from '@/lib/express-payment'

export const runtime = 'nodejs'

/**
 * Polled by the express checkout client once Stripe reports the payment succeeded.
 *
 * The `payment_intent.succeeded` webhook is the primary path to a confirmed booking;
 * this endpoint exists so a customer is not left staring at a spinner if that event is
 * slow or not enabled on the Stripe endpoint. Both call the same idempotent finalizer,
 * so whichever arrives second is a no-op.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    const paymentId = new URL(request.url).searchParams.get('payment_id')
    if (!paymentId) {
      return NextResponse.json({ error: 'Missing payment_id.' }, { status: 400 })
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        userId: true,
        status: true,
        reservationId: true,
        stripeAccountId: true,
        stripePaymentIntentId: true,
      },
    })

    // Same 404 for "no such payment" and "not yours" so this can't be used to probe
    // which payment ids exist.
    if (!payment || payment.userId !== session.user.id) {
      return NextResponse.json({ error: 'Payment not found.' }, { status: 404 })
    }

    if (payment.status === 'PAID') {
      return NextResponse.json({ status: 'paid', reservationId: payment.reservationId })
    }

    if (!payment.stripePaymentIntentId) {
      return NextResponse.json({ status: 'pending', reservationId: null })
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(
      payment.stripePaymentIntentId,
      { expand: ['latest_charge'] },
      { stripeAccount: payment.stripeAccountId || undefined }
    )

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json({
        status: paymentIntent.status === 'canceled' ? 'failed' : 'pending',
        reservationId: null,
      })
    }

    const result = await finalizeExpressPayment({
      paymentId: payment.id,
      paymentIntent,
      stripeAccount: payment.stripeAccountId,
    })

    if (result.status === 'refunded') {
      return NextResponse.json({ status: 'refunded', reservationId: null, reason: result.reason })
    }

    if (result.status === 'ignored') {
      return NextResponse.json({ status: 'pending', reservationId: null })
    }

    return NextResponse.json({ status: 'paid', reservationId: result.reservationId })
  } catch (error) {
    console.error('GET /api/payments/express/status:', error)
    return NextResponse.json({ error: 'Failed to check payment status.' }, { status: 500 })
  }
}
