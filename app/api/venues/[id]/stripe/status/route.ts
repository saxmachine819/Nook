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
      select: { id: true, name: true, ownerId: true, stripeAccountId: true },
    })

    if (!venue) {
      return NextResponse.json({ error: "Venue not found." }, { status: 404 })
    }

    const guard = await requireVenueAdminOrOwner(venueId, session.user, venue)
    if (guard) return guard

    if (!venue.stripeAccountId) {
      return NextResponse.json({
        status: "missing",
        needsOnboarding: true,
        disabledReason: null,
        messages: ["Stripe account not connected yet."],
      })
    }

    const account = await stripe.accounts.retrieve(venue.stripeAccountId)
    const requirements = account.requirements

    const currentlyDue = requirements?.currently_due ?? []
    const eventuallyDue = requirements?.eventually_due ?? []
    const pastDue = requirements?.past_due ?? []
    const errors = requirements?.errors ?? []
    const disabledReason = account.disabled_reason ?? null

    const needsOnboarding =
      currentlyDue.length > 0 ||
      pastDue.length > 0 ||
      errors.length > 0 ||
      !!disabledReason

    const messages: string[] = []

    if (pastDue.length > 0 || currentlyDue.length > 0) {
      messages.push("Additional Stripe verification details are required.")
    }

    if (eventuallyDue.length > 0 && currentlyDue.length === 0 && pastDue.length === 0) {
      messages.push("Stripe will request more details soon.")
    }

    errors.forEach((error) => {
      if (error?.reason) {
        messages.push(error.reason)
      } else if (error?.code) {
        messages.push(`Stripe error: ${error.code}`)
      }
    })

    if (messages.length === 0) {
      messages.push("Stripe account is connected.")
    }

    return NextResponse.json({
      status: needsOnboarding ? "needs_attention" : "ok",
      needsOnboarding,
      disabledReason,
      messages,
    })
  } catch (error) {
    console.error("GET /api/venues/[id]/stripe/status:", error)
    return NextResponse.json(
      {
        status: "error",
        needsOnboarding: false,
        disabledReason: null,
        messages: ["Unable to load Stripe status."],
      },
      { status: 500 }
    )
  }
}
