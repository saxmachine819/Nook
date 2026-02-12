import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { claimVenueMembershipForUser } from "@/lib/venue-members"
import { isAdmin } from "@/lib/venue-auth"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let email = session.user.email
    if (!email) {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { email: true },
      })
      email = dbUser?.email ?? null
    }

    const isUserAdmin = isAdmin({ email })

    if (isUserAdmin) {
      const count = await prisma.venue.count({
        where: { status: { not: "DELETED" } },
      })
      return NextResponse.json({ count, singleVenueId: null })
    }

    await claimVenueMembershipForUser({
      id: session.user.id,
      email: email ?? undefined,
    })

    const [memberRows, ownedVenues] = await Promise.all([
      prisma.venueMember.findMany({
        where: {
          OR: [
            { userId: session.user.id },
            ...(email
              ? [{ email: { equals: email, mode: "insensitive" as const } }]
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

    const count = allVenueIds.size
    const singleVenueId = count === 1 ? Array.from(allVenueIds)[0] : null

    return NextResponse.json({ count, singleVenueId })
  } catch (e) {
    console.error("GET /api/users/me/venues/summary:", e)
    return NextResponse.json(
      { error: "Failed to fetch venue summary." },
      { status: 500 }
    )
  }
}
