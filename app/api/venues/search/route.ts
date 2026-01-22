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
        tables: {
          include: {
            seats: true,
          },
        },
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
      // Calculate capacity: use actual Seat records if available, otherwise fall back to table.seatCount
      const capacity = venue.tables.reduce((sum, table) => {
        if (table.seats.length > 0) {
          return sum + table.seats.length
        }
        // Fallback for older venues without Seat records
        return sum + (table.seatCount || 0)
      }, 0)
      
      // Calculate pricing based on booking modes
      const groupTables = venue.tables.filter(t => (t as any).bookingMode === "group")
      const individualTables = venue.tables.filter(t => (t as any).bookingMode === "individual")
      
      let averageSeatPrice = venue.hourlySeatPrice
      
      if (individualTables.length > 0) {
        const individualSeats = individualTables.flatMap(t => t.seats)
        if (individualSeats.length > 0) {
          averageSeatPrice = individualSeats.reduce((sum, seat) => sum + (seat as any).pricePerHour, 0) / individualSeats.length
        }
      } else if (groupTables.length > 0) {
        // Only group tables - calculate average table price per seat
        const groupPrices = groupTables
          .filter(t => (t as any).tablePricePerHour)
          .map(t => ({ price: (t as any).tablePricePerHour!, seatCount: t.seats.length }))
        if (groupPrices.length > 0) {
          const totalPricePerSeat = groupPrices.reduce((sum, t) => sum + (t.price / t.seatCount), 0)
          averageSeatPrice = totalPricePerSeat / groupPrices.length
        }
      }
      
      const venueReservations = reservationsByVenue[venue.id] || []
      const availabilityLabel = computeAvailabilityLabel(capacity, venueReservations)

      // Parse and combine image URLs
      // heroImageUrl takes priority as first image, then imageUrls array
      let imageUrls: string[] = []
      const venueWithImages = venue as any
      
      // Parse imageUrls JSON field (can be array, string, or null)
      if (venueWithImages.imageUrls) {
        if (Array.isArray(venueWithImages.imageUrls)) {
          imageUrls = venueWithImages.imageUrls.filter((url: any): url is string => typeof url === 'string' && url.length > 0)
        } else if (typeof venueWithImages.imageUrls === 'string') {
          try {
            const parsed = JSON.parse(venueWithImages.imageUrls)
            if (Array.isArray(parsed)) {
              imageUrls = parsed.filter((url: any): url is string => typeof url === 'string' && url.length > 0)
            }
          } catch {
            // If parsing fails, treat as single URL string
            if (venueWithImages.imageUrls.length > 0) {
              imageUrls = [venueWithImages.imageUrls]
            }
          }
        }
      }
      
      // Add heroImageUrl as first image if it exists
      if (venueWithImages.heroImageUrl && typeof venueWithImages.heroImageUrl === 'string' && venueWithImages.heroImageUrl.length > 0) {
        imageUrls = [venueWithImages.heroImageUrl, ...imageUrls.filter((url: string) => url !== venueWithImages.heroImageUrl)]
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
        hourlySeatPrice: averageSeatPrice, // Use average seat price for display
        tags: venue.tags || [],
        capacity,
        rulesText: venue.rulesText || "",
        availabilityLabel,
        imageUrls,
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
