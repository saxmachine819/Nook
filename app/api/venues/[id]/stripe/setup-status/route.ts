import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireVenueAdminOrOwner } from "@/lib/venue-members"
import { stripe } from "@/lib/stripe"

export const runtime = "nodejs"

export type StripeSetupStatus =
  | { status: "not_started" }
  | {
      status: "connected"
      chargesEnabled: boolean
      payoutsEnabled: boolean
      disabledReason?: string | null
      currentDeadline?: number | null
      currentlyDue: string[]
      pastDue: string[]
      pendingVerification: string[]
      errors: Array<{ code?: string; reason?: string; requirement?: string }>
    }
  | { status: "error"; message: string }

function sanitizeError(
  err: { code?: string; reason?: string; requirement?: string }
): { code?: string; reason?: string; requirement?: string } {
  return {
    ...(err.code != null && { code: err.code }),
    ...(err.reason != null && { reason: err.reason }),
    ...(err.requirement != null && { requirement: err.requirement }),
  }
}

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
      return NextResponse.json({ status: "not_started" } as StripeSetupStatus)
    }

    const account = await stripe.accounts.retrieve(venue.stripeAccountId)
    const requirements = account.requirements

    const currentlyDue = (requirements?.currently_due ?? []) as string[]
    const pastDue = (requirements?.past_due ?? []) as string[]
    const pendingVerification = (requirements?.pending_verification ?? []) as string[]
    const disabledReason = requirements?.disabled_reason ?? null
    const currentDeadline = requirements?.current_deadline ?? null
    const rawErrors = requirements?.errors ?? []
    const errors = rawErrors.map((e) => sanitizeError(e as { code?: string; reason?: string; requirement?: string }))

    const connected: StripeSetupStatus = {
      status: "connected",
      chargesEnabled: account.charges_enabled ?? false,
      payoutsEnabled: account.payouts_enabled ?? false,
      disabledReason,
      currentDeadline: currentDeadline != null ? currentDeadline : null,
      currentlyDue,
      pastDue,
      pendingVerification,
      errors,
    }

    return NextResponse.json(connected)
  } catch (error) {
    console.error("GET /api/venues/[id]/stripe/setup-status:", error)
    return NextResponse.json(
      { status: "error", message: "Unable to load Stripe status" } as StripeSetupStatus
    )
  }
}
