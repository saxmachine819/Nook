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
    const north = searchParams.get("north")
    const south = searchParams.get("south")
    const east = searchParams.get("east")
    const west = searchParams.get("west")
    const q = searchParams.get("q")?.trim() || ""
    
    // Filter parameters
    const tagsParam = searchParams.get("tags")
    const tags = tagsParam ? tagsParam.split(",").filter(Boolean) : []
    const priceMin = searchParams.get("priceMin")
    const priceMax = searchParams.get("priceMax")
    const priceMinNum = priceMin ? parseFloat(priceMin) : null
    const priceMaxNum = priceMax ? parseFloat(priceMax) : null
    const seatCountParam = searchParams.get("seatCount")
    const seatCount = seatCountParam ? parseInt(seatCountParam, 10) : null
    const bookingModeParam = searchParams.get("bookingMode")
    const bookingModes = bookingModeParam ? (bookingModeParam.split(",").filter(Boolean) as ("communal" | "full-table")[]) : []
    // Note: openNow is not implemented yet (coming soon)

    // Validate bounds if provided
    const hasBounds = north && south && east && west
    let boundsValid = false
    let parsedBounds: { north: number; south: number; east: number; west: number } | null = null

    if (hasBounds) {
      const northNum = parseFloat(north)
      const southNum = parseFloat(south)
      const eastNum = parseFloat(east)
      const westNum = parseFloat(west)

      if (
        !isNaN(northNum) &&
        !isNaN(southNum) &&
        !isNaN(eastNum) &&
        !isNaN(westNum) &&
        northNum > southNum &&
        eastNum > westNum
      ) {
        boundsValid = true
        parsedBounds = { north: northNum, south: southNum, east: eastNum, west: westNum }
      } else if (hasBounds) {
        // Bounds provided but invalid
        return NextResponse.json(
          { error: "Invalid map bounds provided." },
          { status: 400 }
        )
      }
    }

    const now = new Date()
    const horizonEnd = new Date(now.getTime() + 12 * 60 * 60 * 1000)

    // Build where clause
    const whereClause: any = {}

    // Add bounds filter if valid bounds provided
    if (boundsValid && parsedBounds) {
      whereClause.latitude = {
        gte: parsedBounds.south,
        lte: parsedBounds.north,
      }
      whereClause.longitude = {
        gte: parsedBounds.west,
        lte: parsedBounds.east,
      }
    }

    // Add text search filter if query provided
    if (q.length > 0) {
      const searchConditions: any[] = [
        { name: { contains: q, mode: "insensitive" as const } },
        { address: { contains: q, mode: "insensitive" as const } },
      ]

      // Add city and neighborhood if they exist
      if (q.length > 0) {
        searchConditions.push({ city: { contains: q, mode: "insensitive" as const } })
        searchConditions.push({ neighborhood: { contains: q, mode: "insensitive" as const } })
      }

      // For tags array search, we'll filter in JavaScript after fetching
      // Prisma doesn't have great array contains with case-insensitive matching
      whereClause.OR = searchConditions
    }

    // Add tags filter (hasSome - match any selected tag)
    if (tags.length > 0) {
      whereClause.tags = {
        hasSome: tags,
      }
    }

    // Add price filter (using venue.hourlySeatPrice as "starting at" price)
    if (priceMinNum !== null && !isNaN(priceMinNum)) {
      whereClause.hourlySeatPrice = {
        ...(whereClause.hourlySeatPrice || {}),
        gte: priceMinNum,
      }
    }
    if (priceMaxNum !== null && !isNaN(priceMaxNum)) {
      whereClause.hourlySeatPrice = {
        ...(whereClause.hourlySeatPrice || {}),
        lte: priceMaxNum,
      }
    }

    // Query venues with filters
    let venues = await prisma.venue.findMany({
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
      include: {
        tables: {
          include: {
            seats: true,
          },
        },
      },
      take: 100, // Limit results
      orderBy: q.length > 0 ? { name: "asc" } : { createdAt: "desc" },
    })

    // Filter by tags if query provided (case-insensitive)
    if (q.length > 0) {
      const queryLower = q.toLowerCase()
      venues = venues.filter((venue) => {
        // Check if already matched by other fields
        const matchedByOtherFields = 
          venue.name.toLowerCase().includes(queryLower) ||
          venue.address?.toLowerCase().includes(queryLower) ||
          venue.city?.toLowerCase().includes(queryLower) ||
          venue.neighborhood?.toLowerCase().includes(queryLower)

        if (matchedByOtherFields) return true

        // Check tags array
        if (Array.isArray(venue.tags) && venue.tags.length > 0) {
          return venue.tags.some((tag: string) => tag.toLowerCase().includes(queryLower))
        }

        return false
      })
    }

    // Apply seat count filter (requires calculating capacity)
    if (seatCount !== null && !isNaN(seatCount) && seatCount > 0) {
      venues = venues.filter((venue) => {
        // Calculate total capacity
        const capacity = venue.tables.reduce((sum, table) => {
          if (table.seats.length > 0) {
            return sum + table.seats.length
          }
          return sum + (table.seatCount || 0)
        }, 0)
        return capacity >= seatCount
      })
    }

    // Apply booking mode filter (multiple modes can be selected)
    if (bookingModes.length > 0) {
      venues = venues.filter((venue) => {
        // Check if venue matches any of the selected booking modes
        return bookingModes.some((mode) => {
          if (mode === "communal") {
            // Check if venue has any communal tables
            return venue.tables.some((table) => (table as any).isCommunal === true)
          } else if (mode === "full-table") {
            // Check if venue has any group booking mode tables
            return venue.tables.some((table) => (table as any).bookingMode === "group")
          }
          return false
        })
      })
    }

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
