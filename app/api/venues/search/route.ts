import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function roundUpToNext15Minutes(date: Date): Date {
  const result = new Date(date)
  const minutes = result.getMinutes()
  const remainder = minutes % 15
  if (remainder !== 0) {
    result.setMinutes(minutes + (15 - remainder), 0, 0)
  } else if (result.getSeconds() > 0 || result.getMilliseconds() > 0) {
    result.setMinutes(minutes + 15, 0, 0)
  } else {
    result.setSeconds(0, 0)
  }
  return result
}

function formatTimeLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function computeAvailabilityLabel(
  capacity: number,
  reservations: { startAt: Date; endAt: Date; seatCount: number }[]
): string {
  if (capacity <= 0) return "Sold out for now"

  const now = new Date()
  const startBase = roundUpToNext15Minutes(now)
  const horizonMs = 12 * 60 * 60 * 1000 // 12 hours
  const slotMs = 15 * 60 * 1000 // 15 minutes

  for (let offset = 0; offset < horizonMs; offset += slotMs) {
    const windowStart = new Date(startBase.getTime() + offset)
    const windowEnd = new Date(windowStart.getTime() + 60 * 60 * 1000) // 1 hour window

    const bookedSeats = reservations.reduce((sum, res) => {
      if (res.startAt < windowEnd && res.endAt > windowStart) {
        return sum + res.seatCount
      }
      return sum
    }, 0)

    if (bookedSeats < capacity) {
      if (offset === 0) {
        return "Available now"
      }
      return `Next available at ${formatTimeLabel(windowStart)}`
    }
  }

  return "Sold out for now"
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const north = parseFloat(searchParams.get("north") || "")
    const south = parseFloat(searchParams.get("south") || "")
    const east = parseFloat(searchParams.get("east") || "")
    const west = parseFloat(searchParams.get("west") || "")

    // Validate bounds
    if (
      isNaN(north) ||
      isNaN(south) ||
      isNaN(east) ||
      isNaN(west) ||
      north <= south ||
      east <= west
    ) {
      return NextResponse.json(
        { error: "Invalid map bounds provided." },
        { status: 400 }
      )
    }

    const now = new Date()
    const horizonEnd = new Date(now.getTime() + 12 * 60 * 60 * 1000)

    // Query venues within bounds
    const venues = await prisma.venue.findMany({
      where: {
        latitude: {
          gte: south,
          lte: north,
        },
        longitude: {
          gte: west,
          lte: east,
        },
      },
      include: {
        tables: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    const venueIds = venues.map((v) => v.id)

    const reservations = venueIds.length
      ? await prisma.reservation.findMany({
          where: {
            venueId: { in: venueIds },
            status: {
              not: "cancelled",
            },
            startAt: {
              lt: horizonEnd,
            },
            endAt: {
              gt: now,
            },
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

    // Format venues for client
    const formattedVenues = venues.map((venue) => {
      const capacity = venue.tables.reduce((sum, table) => sum + table.seatCount, 0)
      const venueReservations = reservationsByVenue[venue.id] || []
      const availabilityLabel = computeAvailabilityLabel(capacity, venueReservations)

      return {
        id: venue.id,
        name: venue.name,
        address: venue.address || "",
        neighborhood: venue.neighborhood || "",
        city: venue.city || "",
        state: venue.state || "",
        latitude: venue.latitude,
        longitude: venue.longitude,
        hourlySeatPrice: venue.hourlySeatPrice,
        tags: venue.tags || [],
        capacity,
        rulesText: venue.rulesText || "",
        availabilityLabel,
      }
    })

    return NextResponse.json({ venues: formattedVenues })
  } catch (error) {
    console.error("Error searching venues by bounds:", error)
    return NextResponse.json(
      { error: "Failed to search venues. Please try again." },
      { status: 500 }
    )
  }
}
