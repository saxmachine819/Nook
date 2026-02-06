import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditVenue } from "@/lib/venue-auth"
import { stripe } from "@/lib/stripe"

export const runtime = "nodejs"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const venueId = params.id

    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 })
    }

    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, ownerId: true, stripeAccountId: true },
    })

    if (!venue) {
      return NextResponse.json({ error: "Venue not found." }, { status: 404 })
    }

    if (!canEditVenue(session.user, venue)) {
      return NextResponse.json({ error: "Permission denied." }, { status: 403 })
    }

    if (!venue.stripeAccountId) {
      return NextResponse.json(
        { error: "Stripe account not connected." },
        { status: 400 }
      )
    }

    const body = await request.json()
    const amount = Number(body?.amount)

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid payout amount." },
        { status: 400 }
      )
    }

    if (amount < 500) {
      return NextResponse.json(
        { error: "Minimum payout amount is $5.00." },
        { status: 400 }
      )
    }

    const balance = await stripe.balance.retrieve({
      stripeAccount: venue.stripeAccountId,
    })

    const available =
      balance.available.find((item) => item.currency === "usd")?.amount ?? 0

    if (amount > available) {
      return NextResponse.json(
        { error: "Amount exceeds available balance." },
        { status: 400 }
      )
    }

    const payout = await stripe.payouts.create(
      {
        amount,
        currency: "usd",
      },
      {
        stripeAccount: venue.stripeAccountId,
      }
    )

    return NextResponse.json({ payoutId: payout.id })
  } catch (error) {
    console.error("POST /api/venues/[id]/stripe/payouts:", error)
    return NextResponse.json(
      { error: "Unable to request payout." },
      { status: 500 }
    )
  }
}
