import { cache } from "react"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { canEditVenue } from "@/lib/venue-auth"

export type VenueRole = "admin" | "staff"

type SessionUser = { id: string; email?: string | null }

async function getVenueRoleImpl(
  venueId: string,
  user: SessionUser | null | undefined
): Promise<VenueRole | null> {
  if (!user) {
    return null
  }

  // First check by user_id match if user has id
  if (user.id) {
    const byUserId = await prisma.venueMember.findFirst({
      where: { venueId, userId: user.id },
      select: { role: true },
    })
    if (byUserId) {
      return byUserId.role as VenueRole
    }
  }

  // Fallback to lower(email) match
  if (user.email) {
    const byEmail = await prisma.venueMember.findFirst({
      where: {
        venueId,
        email: user.email.toLowerCase(),
      },
      select: { role: true },
    })
    if (byEmail) {
      return byEmail.role as VenueRole
    }
  }

  return null
}

/**
 * Request-memoized: returns the user's role for the venue from venue_members,
 * or null if not a member. Prefers userId match, then email match (lowercased).
 */
export const getVenueRole = cache(getVenueRoleImpl)

/**
 * Ensures the user is a venue member (any role). Returns a 401/403 NextResponse
 * to return from the route, or null if allowed.
 */
export async function requireVenueMember(
  venueId: string,
  user: SessionUser | null | undefined
): Promise<NextResponse | null> {
  if (!user?.id) {
    return NextResponse.json(
      { error: "You must be signed in." },
      { status: 401 }
    )
  }

  const role = await getVenueRole(venueId, user)
  if (role === null) {
    return NextResponse.json(
      { error: "You don't have permission to access this venue." },
      { status: 403 }
    )
  }

  return null
}

/**
 * Ensures the user is a venue admin. Returns a 401/403 NextResponse to return
 * from the route, or null if allowed.
 */
export async function requireVenueAdmin(
  venueId: string,
  user: SessionUser | null | undefined
): Promise<NextResponse | null> {
  if (!user?.id) {
    return NextResponse.json(
      { error: "You must be signed in." },
      { status: 401 }
    )
  }

  const role = await getVenueRole(venueId, user)
  if (role !== "admin") {
    return NextResponse.json(
      { error: "Admin access required for this venue." },
      { status: 403 }
    )
  }

  return null
}

/**
 * Ensures the user is venue owner (canEditVenue) or venue admin. Returns 403
 * NextResponse for staff and non-members, or null if allowed. Use for Stripe
 * and Team endpoints.
 */
export async function requireVenueAdminOrOwner(
  venueId: string,
  user: SessionUser | null | undefined,
  venue: { ownerId: string | null }
): Promise<NextResponse | null> {
  if (!user?.id) {
    return NextResponse.json(
      { error: "You must be signed in." },
      { status: 401 }
    )
  }
  if (canEditVenue(user, venue)) {
    return null
  }
  const role = await getVenueRole(venueId, user)
  if (role === "admin") {
    return null
  }
  return NextResponse.json(
    { error: "Admin access required for this venue." },
    { status: 403 }
  )
}

/**
 * Idempotent: links unclaimed venue_members rows (same email, no userId) to the
 * current user. Safe to call multiple times.
 */
export async function claimVenueMembershipForUser(
  user: SessionUser | null | undefined
): Promise<void> {
  if (!user?.id || !user?.email) {
    return
  }

  const email = user.email.toLowerCase()
  await prisma.venueMember.updateMany({
    where: {
      userId: null,
      email,
    },
    data: {
      userId: user.id,
    },
  })
}
