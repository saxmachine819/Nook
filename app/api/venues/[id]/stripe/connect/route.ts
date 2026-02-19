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
      select: { id: true, name: true, ownerId: true, stripeAccountId: true },
    })

    if (!venue) {
      return NextResponse.json({ error: "Venue not found." }, { status: 404 })
    }

    const guard = await requireVenueAdminOrOwner(venueId, session.user, venue)
    if (guard) return guard

    let accountId = venue.stripeAccountId

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: venue.name,
        },
        metadata: {
          venueId: venue.id,
        },
      })

      accountId = account.id

      await prisma.venue.update({
        where: { id: venue.id },
        data: { stripeAccountId: accountId },
      })
    }

    const origin = request.headers.get("origin") || process.env.NEXTAUTH_URL
    if (!origin) {
      return NextResponse.json(
        { error: "Missing NEXTAUTH_URL for Stripe redirects." },
        { status: 500 }
      )
    }

    let returnPath = `/venue/dashboard/${venue.id}?stripe=return`
    let refreshPath = `/venue/dashboard/${venue.id}?stripe=refresh`
    try {
      const body = await request.json().catch(() => ({}))
      if (typeof body?.returnPath === "string" && body.returnPath.startsWith("/")) {
        returnPath = body.returnPath
      }
      if (typeof body?.refreshPath === "string" && body.refreshPath.startsWith("/")) {
        refreshPath = body.refreshPath
      }
    } catch {
      // keep defaults
    }

    const refreshUrl = new URL(refreshPath, origin).toString()
    const returnUrl = new URL(returnPath, origin).toString()

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (error) {
    console.error("POST /api/venues/[id]/stripe/connect:", error)
    return NextResponse.json(
      { error: "Failed to create Stripe onboarding link." },
      { status: 500 }
    )
  }
}
