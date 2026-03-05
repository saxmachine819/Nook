import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { batchGetCanonicalVenueHours, isReservationWithinCanonicalHours } from "@/lib/hours"

export const revalidate = 30

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const seatsParam = searchParams.get("seats")
    const seats = seatsParam ? parseInt(seatsParam, 10) : 1
    if (isNaN(seats) || seats < 1 || seats > 10) {
      return NextResponse.json({ error: "Seats must be between 1 and 10" }, { status: 400 })
    }

    const startAtParam = searchParams.get("startAt")
    const endAtParam = searchParams.get("endAt")
    const lat = searchParams.get("lat") ? parseFloat(searchParams.get("lat")!) : null
    const lng = searchParams.get("lng") ? parseFloat(searchParams.get("lng")!) : null
    const locationQuery = searchParams.get("location")?.trim() || ""

    if (!startAtParam || !endAtParam) {
      return NextResponse.json({ error: "Missing startAt and endAt parameters" }, { status: 400 })
    }

    const startAt = new Date(startAtParam)
    const endAt = new Date(endAtParam)

    if (isNaN(startAt.getTime()) || isNaN(endAt.getTime()) || endAt <= startAt) {
      return NextResponse.json({ error: "Invalid startAt/endAt" }, { status: 400 })
    }

    const maxFutureDate = new Date()
    maxFutureDate.setDate(maxFutureDate.getDate() + 30)
    if (startAt > maxFutureDate) {
      return NextResponse.json({ error: "Search date cannot be more than 30 days in the future" }, { status: 400 })
    }

    const whereClause: any = {
      onboardingStatus: "APPROVED",
      status: { not: "DELETED" },
      pausedAt: null,
    }

    if (locationQuery.length > 0) {
      whereClause.OR = [
        { neighborhood: { contains: locationQuery, mode: "insensitive" } },
        { city: { contains: locationQuery, mode: "insensitive" } },
        { address: { contains: locationQuery, mode: "insensitive" } },
        { name: { contains: locationQuery, mode: "insensitive" } },
      ]
    }

    const [venues, reservations, seatBlocks] = await Promise.all([
      prisma.venue.findMany({
        where: whereClause,
        include: {
          tables: {
            include: { seats: true },
          },
        },
        take: 50,
        orderBy: { name: "asc" },
      }),
      prisma.reservation.findMany({
        where: {
          status: { not: "cancelled" },
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
        select: { venueId: true, seatId: true, tableId: true, seatCount: true },
      }),
      prisma.seatBlock.findMany({
        where: {
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
        select: { venueId: true, seatId: true },
      }),
    ])

    const venueIds = venues.map((v) => v.id)
    const hoursMap = await batchGetCanonicalVenueHours(venueIds)

    const reservationsByVenue = new Map<string, typeof reservations>()
    for (const r of reservations) {
      if (!reservationsByVenue.has(r.venueId)) {
        reservationsByVenue.set(r.venueId, [])
      }
      reservationsByVenue.get(r.venueId)!.push(r)
    }

    const seatBlocksByVenue = new Map<string, typeof seatBlocks>()
    for (const b of seatBlocks) {
      if (!seatBlocksByVenue.has(b.venueId)) {
        seatBlocksByVenue.set(b.venueId, [])
      }
      seatBlocksByVenue.get(b.venueId)!.push(b)
    }

    const availableVenues: Array<{
      venue: (typeof venues)[0]
      availableSeats: number
      capacity: number
      timezone: string
    }> = []

    for (const venue of venues) {
      const canonical = hoursMap.get(venue.id)
      if (!canonical) continue

      const hoursCheck = isReservationWithinCanonicalHours(startAt, endAt, canonical)
      if (!hoursCheck.isValid) continue

      const venueAny = venue as any
      let capacity = 0
      for (const table of venueAny.tables) {
        if (table.isActive === false) continue
        if (table.seats.length > 0) {
          capacity += table.seats.filter((s: any) => s.isActive !== false).length
        } else {
          capacity += table.seatCount || 0
        }
      }

      if (capacity < seats) continue

      const venueReservations = reservationsByVenue.get(venue.id) || []
      const venueBlocks = seatBlocksByVenue.get(venue.id) || []

      const unavailableSeatIds = new Set<string>()
      for (const r of venueReservations) {
        if (r.seatId) unavailableSeatIds.add(r.seatId)
      }
      for (const b of venueBlocks) {
        if (b.seatId) unavailableSeatIds.add(b.seatId)
      }

      const hasVenueBlock = venueBlocks.some((b) => b.seatId === null)
      if (hasVenueBlock) continue

      for (const table of venueAny.tables) {
        if (table.isActive === false) continue
        const tableRes = venueReservations.filter((r) => r.tableId === table.id && !r.seatId)
        for (const gr of tableRes) {
          for (const s of table.seats) {
            unavailableSeatIds.add(s.id)
          }
        }
      }

      let availableCount = 0
      for (const table of venueAny.tables) {
        if (table.isActive === false) continue
        for (const seat of table.seats) {
          if (seat.isActive === false) continue
          if (!unavailableSeatIds.has(seat.id)) availableCount++
        }
        if (table.seats.length === 0) {
          const tableBookedSeats = venueReservations
            .filter((r) => r.tableId === table.id)
            .reduce((sum, r) => sum + r.seatCount, 0)
          availableCount += Math.max(0, (table.seatCount || 0) - tableBookedSeats)
        }
      }

      if (availableCount >= seats) {
        availableVenues.push({
          venue,
          availableSeats: Math.min(availableCount, capacity),
          capacity,
          timezone: canonical.timezone,
        })
      }
    }

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

    const results = availableVenues.map(({ venue, availableSeats, capacity, timezone }) => {
      const venueAny = venue as any

      let minPrice = venue.hourlySeatPrice > 0 ? venue.hourlySeatPrice : 0
      for (const table of venueAny.tables) {
        if (table.bookingMode === "individual") {
          for (const seat of table.seats) {
            if (seat.pricePerHour > 0 && (minPrice === 0 || seat.pricePerHour < minPrice)) {
              minPrice = seat.pricePerHour
            }
          }
        } else if (table.bookingMode === "group" && table.tablePricePerHour != null && table.tablePricePerHour > 0) {
          if (minPrice === 0 || table.tablePricePerHour < minPrice) {
            minPrice = table.tablePricePerHour
          }
        }
      }

      let imageUrls: string[] = []
      if (venueAny.imageUrls) {
        if (Array.isArray(venueAny.imageUrls)) {
          imageUrls = venueAny.imageUrls.filter((url: any): url is string => typeof url === "string" && url.length > 0)
        } else if (typeof venueAny.imageUrls === "string") {
          try {
            const parsed = JSON.parse(venueAny.imageUrls)
            if (Array.isArray(parsed)) {
              imageUrls = parsed.filter((url: any): url is string => typeof url === "string" && url.length > 0)
            }
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
        imageUrls: imageUrls.slice(0, 1),
        distanceKm,
        timezone,
      }
    })

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
    return NextResponse.json({ error: "Failed to search venues" }, { status: 500 })
  }
}
