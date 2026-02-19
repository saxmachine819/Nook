import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditVenue } from "@/lib/venue-auth"
import { stripe } from "@/lib/stripe"

const COMMISSION_RATE = 0.2

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 })
    }

    const params = await context.params
    const refundId = params.id

    const refundRequest = await prisma.refundRequest.findUnique({
      where: { id: refundId },
      include: {
        payment: true,
        venue: { select: { id: true, ownerId: true } },
      },
    })

    if (!refundRequest) {
      return NextResponse.json({ error: "Refund request not found." }, { status: 404 })
    }

    if (!refundRequest.venue) {
      return NextResponse.json({ error: "Venue not found." }, { status: 404 })
    }

    if (!canEditVenue(session.user, refundRequest.venue)) {
      return NextResponse.json({ error: "Permission denied." }, { status: 403 })
    }

    if (refundRequest.status !== "REQUESTED") {
      return NextResponse.json({ error: "Refund request is already processed." }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const approvedAmount = Number(body?.approvedAmount)
    const isFull = body?.full === true
    const percent = body?.percent != null ? Number(body.percent) : null

    const refundable = Math.max(0, refundRequest.payment.amount - refundRequest.payment.amountRefunded)

    let finalAmount = approvedAmount
    if (isFull) {
      finalAmount = refundable
    } else if (percent != null && Number.isFinite(percent)) {
      finalAmount = Math.round((percent / 100) * refundable)
    }

    if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
      return NextResponse.json({ error: "Invalid refund amount." }, { status: 400 })
    }

    if (finalAmount > refundable) {
      return NextResponse.json({ error: "Refund amount exceeds refundable balance." }, { status: 400 })
    }

    if (!refundRequest.payment.stripePaymentIntentId || !refundRequest.payment.stripeAccountId) {
      return NextResponse.json({ error: "Stripe payment details are missing." }, { status: 400 })
    }

    await prisma.refundRequest.update({
      where: { id: refundId },
      data: { status: "PROCESSING", amount: finalAmount },
    })

    const refund = await stripe.refunds.create(
      {
        payment_intent: refundRequest.payment.stripePaymentIntentId,
        amount: finalAmount,
      },
      {
        stripeAccount: refundRequest.payment.stripeAccountId,
      }
    )

    // Get application fee amount (from column or metadata fallback for old payments)
    const applicationFeeAmount =
      refundRequest.payment.applicationFeeAmount ??
      (typeof refundRequest.payment.metadata === "object" &&
        refundRequest.payment.metadata !== null &&
        "applicationFeeAmount" in refundRequest.payment.metadata
        ? Number((refundRequest.payment.metadata as { applicationFeeAmount?: number }).applicationFeeAmount) || 0
        : 0)

    if (refundRequest.payment.stripeApplicationFeeId && applicationFeeAmount > 0) {
      const feeRefundAmount = Math.min(
        applicationFeeAmount,
        Math.round(finalAmount * COMMISSION_RATE)
      )
      if (feeRefundAmount > 0) {
        await stripe.applicationFees.createRefund(refundRequest.payment.stripeApplicationFeeId, {
          amount: feeRefundAmount,
        })
      }
    }

    const newRefunded = refundRequest.payment.amountRefunded + finalAmount
    const isFullRefund = newRefunded >= refundRequest.payment.amount

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: refundRequest.paymentId },
        data: {
          amountRefunded: newRefunded,
          status: isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED",
        },
      }),
      prisma.refundRequest.update({
        where: { id: refundId },
        data: { status: "SUCCEEDED", amount: finalAmount },
      }),
    ])

    return NextResponse.json({ refundId: refund.id })
  } catch (error) {
    console.error("POST /api/refunds/[id]/approve:", error)
    return NextResponse.json({ error: "Failed to approve refund." }, { status: 500 })
  }
}
