import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { claimVenueMembershipForUser } from "@/lib/venue-members"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let emailForClaim: string | null = session.user.email ?? null
    if (!emailForClaim) {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { email: true },
      })
      emailForClaim = dbUser?.email ?? null
    }
    await claimVenueMembershipForUser({
      id: session.user.id,
      email: emailForClaim ?? undefined,
    })

    const [memberRows, ownedVenues] = await Promise.all([
      prisma.venueMember.findMany({
        where: {
          OR: [
            { userId: session.user.id },
            ...(emailForClaim
              ? [{ email: { equals: emailForClaim, mode: "insensitive" as const } }]
              : []),
          ],
        },
        select: { venueId: true },
        distinct: ["venueId"],
      }),
      prisma.venue.findMany({
        where: { ownerId: session.user.id, status: { not: "DELETED" } },
        select: { id: true },
      }),
    ])
    const allVenueIds = new Set([
      ...memberRows.map((m) => m.venueId),
      ...ownedVenues.map((v) => v.id),
    ])
    const managedVenues =
      allVenueIds.size === 0
        ? []
        : await prisma.venue.findMany({
            where: {
              id: { in: Array.from(allVenueIds) },
              status: { not: "DELETED" },
            },
            select: { id: true },
          })
    const count = managedVenues.length
    const singleVenueId = count === 1 ? managedVenues[0]?.id ?? null : null

    return NextResponse.json({ count, singleVenueId })
  } catch (e) {
    console.error("GET /api/users/me/venues/summary:", e)
    return NextResponse.json(
      { error: "Failed to fetch venue summary." },
      { status: 500 }
    )
  }
}
