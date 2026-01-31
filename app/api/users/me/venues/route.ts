import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
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

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const admin = isAdmin(session.user)
    const venues = await prisma.venue.findMany({
      where: {
        status: { not: "DELETED" },
        ...(admin ? {} : { ownerId: session.user.id }),
      },
      select: { id: true, name: true, address: true, heroImageUrl: true, imageUrls: true, onboardingStatus: true },
    })

    const list = venues.map((v) => ({
      id: v.id,
      name: v.name,
      address: v.address ?? "",
      thumbnail: thumbnailForVenue(v),
      onboardingStatus: v.onboardingStatus,
    }))

    return NextResponse.json({ venues: list, isAdmin: admin })
  } catch (e) {
    console.error("GET /api/users/me/venues:", e)
    return NextResponse.json(
      { error: "Failed to fetch venues." },
      { status: 500 }
    )
  }
}
