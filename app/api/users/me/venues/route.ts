import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { claimVenueMembershipForUser } from "@/lib/venue-members"
import { isAdmin } from "@/lib/venue-auth"

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

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const mode = searchParams.get("mode")
    const isCountOnly = mode === "count"

    let email = session.user.email
    if (!email) {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { email: true },
      })
      email = dbUser?.email ?? null
    }

    const admin = isAdmin({ email })

    // If count only and admin, return global count quickly
    if (isCountOnly && admin) {
      const count = await prisma.venue.count({
        where: { status: { not: "DELETED" } },
      })
      return NextResponse.json({ count, isAdmin: true })
    }

    // Always claim/sync roles for detailed view OR non-admin count
    await claimVenueMembershipForUser({
      id: session.user.id,
      email: email ?? undefined,
    })

    let venueIds: string[] | undefined
    if (!admin) {
      const [memberRows, ownedVenues] = await Promise.all([
        prisma.venueMember.findMany({
          where: {
            OR: [
              { userId: session.user.id },
              ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
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
      venueIds = Array.from(new Set([
        ...memberRows.map((m) => m.venueId),
        ...ownedVenues.map((v) => v.id),
      ]))
    }

    if (isCountOnly) {
      // Non-admin count logic
      return NextResponse.json({ 
        count: (admin ? await prisma.venue.count({ where: { status: { not: "DELETED" } } }) : venueIds!.length), 
        isAdmin: admin 
      })
    }

    // Detailed Dashboard View
    const venues =
      !admin && venueIds!.length === 0
        ? []
        : await prisma.venue.findMany({
            where: {
              status: { not: "DELETED" },
              ...(admin ? {} : { id: { in: venueIds! } }),
            },
            select: {
              id: true,
              name: true,
              address: true,
              heroImageUrl: true,
              imageUrls: true,
              onboardingStatus: true,
              pausedAt: true,
            },
          })

    const list = venues.map((v) => ({
      id: v.id,
      name: v.name,
      address: v.address ?? "",
      thumbnail: thumbnailForVenue(v),
      onboardingStatus: v.onboardingStatus,
      pausedAt: v.pausedAt,
    }))

    // Sort by name case-insensitive
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))

    return NextResponse.json({
      venues: list,
      isAdmin: admin,
      userId: session.user.id,
      email: email,
    })
  } catch (e) {
    console.error("GET /api/users/me/venues:", e)
    return NextResponse.json(
      { error: "Failed to fetch venues." },
      { status: 500 }
    )
  }
}
