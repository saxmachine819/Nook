import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { computeAvailabilityLabel } from "@/lib/availability-utils"
import { batchGetCanonicalVenueHours, getOpenStatus } from "@/lib/hours"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const seats = parseInt(searchParams.get("seats") || "1", 10)
    const lat = searchParams.get("lat") ? parseFloat(searchParams.get("lat")!) : null
    const lng = searchParams.get("lng") ? parseFloat(searchParams.get("lng")!) : null
    const availableNow = searchParams.get("availableNow") === "true"

    const now = new Date()
    const horizonEnd = new Date(now.getTime() + 12 * 60 * 60 * 1000)

    const whereClause: any = {
      onboardingStatus: "APPROVED",
      status: { not: "DELETED" },
      pausedAt: null,
    }

    let venues = await prisma.venue.findMany({
      where: whereClause,
      include: {
        tables: {
          include: { seats: true },
        },
        venueHours: {
          orderBy: { dayOfWeek: "asc" },
        },
      } as any,
      take: 50,
      orderBy: { name: "asc" },
    })

    // Filter by seat capacity
    if (seats > 0) {
      venues = venues.filter((venue) => {
        const venueAny = venue as any
        const capacity = venueAny.tables.reduce((sum: number, table: any) => {
          if (table.seats.length > 0) return sum + table.seats.length
          return sum + (table.seatCount || 0)
        }, 0)
        return capacity >= seats
      })
    }

    const venueIds = venues.map((v) => v.id)

    const reservations = venueIds.length
      ? await prisma.reservation.findMany({
          where: {
            venueId: { in: venueIds },
            status: { not: "cancelled" },
            startAt: { lt: horizonEnd },
            endAt: { gt: now },
          },
          select: {
            venueId: true,
            startAt: true,
            endAt: true,
            seatCount: true,
          },
        })
      : []

    const reservationsByVenue = reservations.reduce<
      Record<string, { startAt: Date; endAt: Date; seatCount: number }[]>
    >((acc, res) => {
      if (!acc[res.venueId]) acc[res.venueId] = []
      acc[res.venueId].push({
        startAt: res.startAt,
        endAt: res.endAt,
        seatCount: res.seatCount,
      })
      return acc
    }, {})

    const hoursMap = await batchGetCanonicalVenueHours(venueIds)

    let venuesWithStatus = venues.map((venue) => {
      try {
        const canonical = hoursMap.get(venue.id) ?? null
        const openStatus = canonical ? getOpenStatus(canonical, now) : null
        return { venue, openStatus, timezone: canonical?.timezone ?? null }
      } catch {
        return { venue, openStatus: null, timezone: null }
      }
    })

    // Filter for "available now" if requested
    if (availableNow) {
      venuesWithStatus = venuesWithStatus.filter(({ venue, openStatus }) => {
        if (!openStatus?.isOpen) return false
        const venueAny = venue as any
        const capacity = venueAny.tables.reduce((sum: number, table: any) => {
          if (table.seats.length > 0) return sum + table.seats.length
          return sum + (table.seatCount || 0)
        }, 0)
        if (capacity <= 0) return false

        const minutes = now.getMinutes()
        const remainder = minutes % 15
        const startBase = new Date(now)
        if (remainder !== 0) {
          startBase.setMinutes(minutes + (15 - remainder), 0, 0)
        } else {
          startBase.setSeconds(0, 0)
        }
        const windowEnd = new Date(startBase.getTime() + 60 * 60 * 1000)

        const venueRes = reservationsByVenue[venue.id] || []
        const bookedSeats = venueRes.reduce((sum, res) => {
          if (res.startAt < windowEnd && res.endAt > startBase) return sum + res.seatCount
          return sum
        }, 0)

        return (capacity - bookedSeats) >= seats
      })
    }

    // Compute distance from user if location provided
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

    const results = venuesWithStatus.map(({ venue, openStatus, timezone }) => {
      const venueAny = venue as any
      const capacity = venueAny.tables.reduce((sum: number, table: any) => {
        if (table.seats.length > 0) return sum + table.seats.length
        return sum + (table.seatCount || 0)
      }, 0)

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

      const venueReservations = reservationsByVenue[venue.id] || []
      const availabilityLabel = computeAvailabilityLabel(
        capacity,
        venueReservations,
        openStatus,
        { timeZone: timezone ?? undefined }
      )

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
        availabilityLabel,
        openStatus: openStatus
          ? { status: openStatus.status, todayHoursText: openStatus.todayHoursText }
          : null,
        imageUrls,
        distanceKm,
      }
    })

    // Sort by distance if location is available, otherwise by name
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
