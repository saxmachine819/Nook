import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireVenueAdminOrOwner } from "@/lib/venue-members"
import { stripe } from "@/lib/stripe"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
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

    const guard = await requireVenueAdminOrOwner(venueId, session.user, venue)
    if (guard) return guard

    if (!venue.stripeAccountId) {
      return NextResponse.json(
        { error: "Stripe account not connected." },
        { status: 400 }
      )
    }

    const balance = await stripe.balance.retrieve({
      stripeAccount: venue.stripeAccountId,
    })

    const currency = "usd"
    
    // Sum all amounts for the target currency (Stripe may split them by source_type)
    const available = balance.available
      .filter((item) => item.currency === currency)
      .reduce((sum, item) => sum + item.amount, 0)
    
    const pending = balance.pending
      .filter((item) => item.currency === currency)
      .reduce((sum, item) => sum + item.amount, 0)

    const instantAvailable = (balance as any).instant_available
      ?.filter((item: any) => item.currency === currency)
      .reduce((sum: number, item: any) => sum + item.amount, 0) ?? 0

    return NextResponse.json({
      available,
      pending,
      instantAvailable,
      currency,
    })
  } catch (error) {
    console.error("GET /api/venues/[id]/stripe/balance:", error)
    return NextResponse.json(
      { error: "Unable to load Stripe balance." },
      { status: 500 }
    )
  }
}
