import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  getCanonicalVenueHours,
  isReservationWithinCanonicalHours,
} from "@/lib/hours"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const seats = parseInt(searchParams.get("seats") || "1", 10)
    const startAtParam = searchParams.get("startAt")
    const endAtParam = searchParams.get("endAt")
    const lat = searchParams.get("lat") ? parseFloat(searchParams.get("lat")!) : null
    const lng = searchParams.get("lng") ? parseFloat(searchParams.get("lng")!) : null
    const locationQuery = searchParams.get("location")?.trim() || ""

    if (!startAtParam || !endAtParam) {
      return NextResponse.json(
        { error: "Missing startAt and endAt parameters." },
        { status: 400 }
      )
    }

    const startAt = new Date(startAtParam)
    const endAt = new Date(endAtParam)

    if (isNaN(startAt.getTime()) || isNaN(endAt.getTime()) || endAt <= startAt) {
      return NextResponse.json(
        { error: "Invalid startAt/endAt." },
        { status: 400 }
      )
    }

    const whereClause: any = {
      onboardingStatus: "APPROVED",
      status: { not: "DELETED" },
      pausedAt: null,
    }

    // Text-based location filter
    if (locationQuery.length > 0) {
      whereClause.OR = [
        { neighborhood: { contains: locationQuery, mode: "insensitive" } },
        { city: { contains: locationQuery, mode: "insensitive" } },
        { address: { contains: locationQuery, mode: "insensitive" } },
        { name: { contains: locationQuery, mode: "insensitive" } },
      ]
    }

    let venues = await prisma.venue.findMany({
      where: whereClause,
      include: {
        tables: {
          include: { seats: true },
        },
      } as any,
      take: 100,
      orderBy: { name: "asc" },
    })

    // Filter by total seat capacity
    venues = venues.filter((venue) => {
      const venueAny = venue as any
      const capacity = venueAny.tables.reduce((sum: number, table: any) => {
        if (table.isActive === false) return sum
        const activeSeats = table.seats.filter((s: any) => s.isActive !== false)
        if (activeSeats.length > 0) return sum + activeSeats.length
        return sum + (table.seatCount || 0)
      }, 0)
      return capacity >= seats
    })

    // Per-venue availability check: verify hours + reservations + blocks
    const availableVenues: Array<{
      venue: typeof venues[0]
      availableSeats: number
      capacity: number
    }> = []

    for (const venue of venues) {
      // Check canonical hours
      const canonical = await getCanonicalVenueHours(venue.id)
      if (!canonical) continue

      const hoursCheck = isReservationWithinCanonicalHours(startAt, endAt, canonical)
      if (!hoursCheck.isValid) continue

      // Check reservations overlap
      const venueAny = venue as any
      const capacity = venueAny.tables.reduce((sum: number, table: any) => {
        if (table.isActive === false) return sum
        const activeSeats = table.seats.filter((s: any) => s.isActive !== false)
        if (activeSeats.length > 0) return sum + activeSeats.length
        return sum + (table.seatCount || 0)
      }, 0)

      const overlapping = await prisma.reservation.findMany({
        where: {
          venueId: venue.id,
          status: { not: "cancelled" },
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
        select: { seatId: true, tableId: true, seatCount: true },
      })

      const overlappingBlocks = await prisma.seatBlock.findMany({
        where: {
          venueId: venue.id,
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
        select: { seatId: true },
      })

      // Count unavailable seat IDs
      const unavailableSeatIds = new Set<string>()
      overlapping.forEach((r) => {
        if (r.seatId) unavailableSeatIds.add(r.seatId)
      })
      overlappingBlocks.forEach((b) => {
        if (b.seatId) unavailableSeatIds.add(b.seatId)
      })

      // Venue-wide blocks
      const hasVenueBlock = overlappingBlocks.some((b) => b.seatId === null)
      if (hasVenueBlock) continue

      // Group table reservations block all seats in the table
      const groupRes = overlapping.filter((r) => r.tableId && !r.seatId)
      for (const gr of groupRes) {
        const table = venueAny.tables.find((t: any) => t.id === gr.tableId)
        if (table) {
          table.seats.forEach((s: any) => unavailableSeatIds.add(s.id))
        }
      }

      // Count available seats
      let availableCount = 0
      for (const table of venueAny.tables) {
        if (table.isActive === false) continue
        for (const seat of table.seats) {
          if (seat.isActive === false) continue
          if (!unavailableSeatIds.has(seat.id)) availableCount++
        }
        // Fallback for tables without Seat records
        if (table.seats.length === 0) {
          const tableBookedSeats = overlapping
            .filter((r) => r.tableId === table.id)
            .reduce((sum, r) => sum + r.seatCount, 0)
          availableCount += Math.max(0, (table.seatCount || 0) - tableBookedSeats)
        }
      }

      if (availableCount >= seats) {
        const availableSeats = Math.min(availableCount, capacity)
        availableVenues.push({ venue, availableSeats, capacity })
      }
    }

    // Distance helper
    function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
      const R = 6371
      const dLat = ((lat2 - lat1) * Math.PI) / 180
      const dLon = ((lon2 - lon1) * Math.PI) / 180
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2)
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }

    // Format results
    const results = availableVenues.map(({ venue, availableSeats, capacity }) => {
      const venueAny = venue as any

      const allSeatPrices = venueAny.tables
        .filter((t: any) => t.bookingMode === "individual")
        .flatMap((t: any) =>
          (t.seats || []).map((s: any) => s.pricePerHour).filter((p: number) => p != null && p > 0)
        )
      const allTablePrices = venueAny.tables
        .filter((t: any) => t.bookingMode === "group" && t.tablePricePerHour != null && t.tablePricePerHour > 0)
        .map((t: any) => t.tablePricePerHour)
      const candidatePrices = [...allSeatPrices, ...allTablePrices]
      const fallback = venue.hourlySeatPrice > 0 ? venue.hourlySeatPrice : 0
      const minPrice = candidatePrices.length > 0 ? Math.min(...candidatePrices) : fallback

      let imageUrls: string[] = []
      if (venueAny.imageUrls) {
        if (Array.isArray(venueAny.imageUrls)) {
          imageUrls = venueAny.imageUrls.filter((url: any): url is string => typeof url === "string" && url.length > 0)
        } else if (typeof venueAny.imageUrls === "string") {
          try {
            const parsed = JSON.parse(venueAny.imageUrls)
            if (Array.isArray(parsed)) imageUrls = parsed.filter((url: any): url is string => typeof url === "string" && url.length > 0)
          } catch {
            if (venueAny.imageUrls.length > 0) imageUrls = [venueAny.imageUrls]
          }
        }
      }
      if (venueAny.heroImageUrl && typeof venueAny.heroImageUrl === "string" && venueAny.heroImageUrl.length > 0) {
        imageUrls = [venueAny.heroImageUrl, ...imageUrls.filter((url: string) => url !== venueAny.heroImageUrl)]
      }

      let distanceKm: number | null = null
      if (lat != null && lng != null && venue.latitude != null && venue.longitude != null) {
        distanceKm = haversineKm(lat, lng, venue.latitude, venue.longitude)
      }

      return {
        id: venue.id,
        name: venue.name,
        address: venue.address || "",
        neighborhood: venue.neighborhood || "",
        city: venue.city || "",
        state: venue.state || "",
        latitude: venue.latitude,
        longitude: venue.longitude,
        minPrice,
        capacity,
        availableSeats,
        imageUrls,
        distanceKm,
      }
    })

    // Results are sorted by distance when lat/lng are provided.
    if (lat != null && lng != null) {
      results.sort((a, b) => {
        if (a.distanceKm == null && b.distanceKm == null) return 0
        if (a.distanceKm == null) return 1
        if (b.distanceKm == null) return -1
        return a.distanceKm - b.distanceKm
      })
    }

    return NextResponse.json({ venues: results })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("Error in search API:", message)
    return NextResponse.json(
      { error: "Failed to search venues." },
      { status: 500 }
    )
  }
}
