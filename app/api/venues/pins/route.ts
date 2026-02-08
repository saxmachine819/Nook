import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { batchGetCanonicalVenueHours, getOpenStatus } from "@/lib/hours"
import type { OpenStatusValue } from "@/types/venue"

export const dynamic = "force-dynamic"

/**
 * Lightweight pins endpoint for map markers.
 * Returns: id, name, minPrice, lat, lng, openStatus (~120 bytes per venue)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const north = searchParams.get("north")
    const south = searchParams.get("south")
    const east = searchParams.get("east")
    const west = searchParams.get("west")

    if (!north || !south || !east || !west) {
      return NextResponse.json({ error: "Bounds required" }, { status: 400 })
    }

    const bounds = {
      north: parseFloat(north),
      south: parseFloat(south),
      east: parseFloat(east),
      west: parseFloat(west),
    }

    if (Object.values(bounds).some(isNaN)) {
      return NextResponse.json({ error: "Invalid bounds" }, { status: 400 })
    }

    const venues = await prisma.venue.findMany({
      where: {
        onboardingStatus: "APPROVED",
        status: { not: "DELETED" },
        pausedAt: null,
        latitude: { gte: bounds.south, lte: bounds.north },
        longitude: { gte: bounds.west, lte: bounds.east },
      },
      select: {
        id: true,
        name: true,
        hourlySeatPrice: true,
        latitude: true,
        longitude: true,
      },
      take: 200,
    })

    const venueIds = venues.map((v) => v.id)
    const hoursMap = await batchGetCanonicalVenueHours(venueIds)
    const now = new Date()

    const pins = venues
      .filter((v) => v.latitude !== null && v.longitude !== null)
      .map((venue) => {
        const canonical = hoursMap.get(venue.id)
        const openStatus = canonical ? getOpenStatus(canonical, now) : null

        return {
          id: venue.id,
          name: venue.name,
          minPrice: venue.hourlySeatPrice ?? 0,
          lat: venue.latitude as number,
          lng: venue.longitude as number,
          status: (openStatus?.status ?? null) as OpenStatusValue | null,
        }
      })

    return NextResponse.json({ pins, total: pins.length })
  } catch (error) {
    console.error("Error fetching pins:", error)
    return NextResponse.json({ error: "Failed to fetch pins" }, { status: 500 })
  }
}
