import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/venue-auth"
import { claimVenueMembershipForUser } from "@/lib/venue-members"

function thumbnailForVenue(venue: {
  heroImageUrl: string | null
  imageUrls: unknown
}): string | null {
  if (venue.heroImageUrl && typeof venue.heroImageUrl === "string" && venue.heroImageUrl.length > 0) {
    return venue.heroImageUrl
  }
  const raw = venue.imageUrls
  if (!raw) return null
  let urls: string[] = []
  if (Array.isArray(raw)) {
    urls = raw.filter((u): u is string => typeof u === "string" && u.length > 0)
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        urls = parsed.filter((u): u is string => typeof u === "string" && u.length > 0)
      }
    } catch {
      if (raw.length > 0) urls = [raw]
    }
  }
  return urls[0] ?? null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const wantDebug = searchParams.get("debug") === "1" || process.env.NODE_ENV === "development"

    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Session may not include email in some flows; fetch from DB so claim and member query work
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

    const admin = isAdmin(session.user)
    let venueIds: string[] | undefined
    let memberCount = 0
    let ownedCount = 0
    if (!admin) {
      const memberWhere = {
        OR: [
          { userId: session.user.id },
          ...(emailForClaim
            ? [{ email: { equals: emailForClaim, mode: "insensitive" as const } }]
            : []),
        ],
      }
      const [memberRows, ownedVenues] = await Promise.all([
        prisma.venueMember.findMany({
          where: memberWhere,
          select: { venueId: true },
          distinct: ["venueId"],
        }),
        prisma.venue.findMany({
          where: { ownerId: session.user.id, status: { not: "DELETED" } },
          select: { id: true },
        }),
      ])
      let allMemberVenueIds = memberRows.map((m) => m.venueId)
      if (emailForClaim) {
        const byEmailRows = await prisma.venueMember.findMany({
          where: { email: { equals: emailForClaim, mode: "insensitive" } },
          select: { venueId: true },
          distinct: ["venueId"],
        })
        allMemberVenueIds = Array.from(new Set([...allMemberVenueIds, ...byEmailRows.map((m) => m.venueId)]))
      }
      memberCount = allMemberVenueIds.length
      ownedCount = ownedVenues.length
      venueIds = Array.from(
        new Set([...allMemberVenueIds, ...ownedVenues.map((v) => v.id)])
      )
    }
    const venues =
      !admin && venueIds!.length === 0
        ? []
        : await prisma.venue.findMany({
            where: {
              status: { not: "DELETED" },
              ...(admin ? {} : { id: { in: venueIds! } }),
            },
            select: { id: true, name: true, address: true, heroImageUrl: true, imageUrls: true, onboardingStatus: true, pausedAt: true },
          })

    const list = venues.map((v) => ({
      id: v.id,
      name: v.name,
      address: v.address ?? "",
      thumbnail: thumbnailForVenue(v),
      onboardingStatus: v.onboardingStatus,
      pausedAt: v.pausedAt,
    }))

    const payload: {
      venues: typeof list
      isAdmin: boolean
      userId: string
      email: string | null
      _debug?: {
        admin: boolean
        memberCount: number
        ownedCount: number
        venueIds: string[]
        requestedCount: number
        returnedCount: number
      }
    } = {
      venues: list,
      isAdmin: admin,
      userId: session.user.id,
      email: session.user.email ?? emailForClaim ?? null,
    }
    if (wantDebug) {
      payload._debug = {
        admin,
        memberCount,
        ownedCount,
        venueIds: venueIds ?? [],
        requestedCount: venueIds?.length ?? 0,
        returnedCount: venues.length,
      }
    }
    return NextResponse.json(payload)
  } catch (e) {
    console.error("GET /api/users/me/venues:", e)
    return NextResponse.json(
      { error: "Failed to fetch venues." },
      { status: 500 }
    )
  }
}
