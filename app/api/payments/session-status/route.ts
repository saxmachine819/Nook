import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("session_id")

    if (!sessionId) {
      return NextResponse.json({ error: "Missing session_id." }, { status: 400 })
    }

    // First find the payment to get the connected account ID and reservation ID
    const payment = await prisma.payment.findUnique({
      where: { stripeCheckoutSessionId: sessionId },
      select: { stripeAccountId: true, reservationId: true }
    })

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      stripeAccount: payment?.stripeAccountId || undefined
    })

    return NextResponse.json({
      status: session.status,
      customer_email: session.customer_details?.email,
      reservationId: payment?.reservationId ?? null,
    })
  } catch (error) {
    console.error("GET /api/payments/session-status:", error)
    return NextResponse.json(
      { error: "Failed to retrieve session status." },
      { status: 500 }
    )
  }
}
