import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireVenueAdminOrOwner } from "@/lib/venue-members"
import { stripe } from "@/lib/stripe"

export const runtime = "nodejs"

export async function POST(
  request: NextRequest,
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

    const loginLink = await stripe.accounts.createLoginLink(venue.stripeAccountId)

    return NextResponse.json({ url: loginLink.url })
  } catch (error) {
    console.error("POST /api/venues/[id]/stripe/dashboard:", error)
    return NextResponse.json(
      { error: "Failed to open Stripe dashboard." },
      { status: 500 }
    )
  }
}
