import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { formatDealBadgeSummary } from "@/lib/deal-utils"
import { computeAvailabilityLabel } from "@/lib/availability-utils"

export async function GET(request: Request) {
  console.log("🔍 /api/venues/search route called")
  try {
    const { searchParams } = new URL(request.url)
    console.log("📋 Search params:", Object.fromEntries(searchParams.entries()))
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
    const dealsOnly = searchParams.get("dealsOnly") === "true"
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

    // Add dealsOnly filter
    if (dealsOnly) {
      // Filter venues that have at least one active deal
      whereClause.deals = {
        some: { 
          isActive: true 
        }
      }
      console.log("✅ Applied dealsOnly filter to whereClause:", JSON.stringify(whereClause.deals))
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
        deals: {
          where: { isActive: true },
          orderBy: [
            { featured: 'desc' },
            { createdAt: 'desc' }
          ],
          take: 1, // Only need the primary deal
        },
        venueHours: {
          orderBy: {
            dayOfWeek: "asc",
          },
        },
      } as any,
      take: 100, // Limit results
      orderBy: q.length > 0 ? { name: "asc" } : { createdAt: "desc" },
    })
    
    if (dealsOnly) {
      console.log(`📊 Found ${venues.length} venues with deals filter applied`)
    }

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
        const venueWithTables = venue as any
        // Calculate total capacity
        const capacity = venueWithTables.tables.reduce((sum: number, table: any) => {
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
        const venueWithTables = venue as any
        // Check if venue matches any of the selected booking modes
        return bookingModes.some((mode) => {
          if (mode === "communal") {
            // Check if venue has any communal tables
            return venueWithTables.tables.some((table: any) => table.isCommunal === true)
          } else if (mode === "full-table") {
            // Check if venue has any group booking mode tables
            return venueWithTables.tables.some((table: any) => table.bookingMode === "group")
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
      const venueWithIncludes = venue as any
      
      // Calculate capacity: use actual Seat records if available, otherwise fall back to table.seatCount
      const capacity = venueWithIncludes.tables.reduce((sum: number, table: any) => {
        if (table.seats.length > 0) {
          return sum + table.seats.length
        }
        // Fallback for older venues without Seat records
        return sum + (table.seatCount || 0)
      }, 0)
      
      // Calculate pricing based on booking modes
      const groupTables = venueWithIncludes.tables.filter((t: any) => t.bookingMode === "group")
      const individualTables = venueWithIncludes.tables.filter((t: any) => t.bookingMode === "individual")
      
      let averageSeatPrice = venue.hourlySeatPrice
      
      if (individualTables.length > 0) {
        const individualSeats = individualTables.flatMap((t: any) => t.seats)
        if (individualSeats.length > 0) {
          averageSeatPrice = individualSeats.reduce((sum: number, seat: any) => sum + (seat.pricePerHour || 0), 0) / individualSeats.length
        }
      } else if (groupTables.length > 0) {
        // Only group tables - calculate average table price per seat
        const groupPrices = groupTables
          .filter((t: any) => t.tablePricePerHour)
          .map((t: any) => ({ price: t.tablePricePerHour!, seatCount: t.seats.length }))
        if (groupPrices.length > 0) {
          const totalPricePerSeat = groupPrices.reduce((sum: number, t: any) => sum + (t.price / t.seatCount), 0)
          averageSeatPrice = totalPricePerSeat / groupPrices.length
        }
      }
      
      const venueReservations = reservationsByVenue[venue.id] || []
      const venueWithHours = venue as any
      const venueHours = venueWithHours.venueHours || null
      const openingHoursJson = venueWithHours.openingHoursJson || null
      const availabilityLabel = computeAvailabilityLabel(
        capacity,
        venueReservations,
        venueHours,
        openingHoursJson
      )

      // Parse and combine image URLs
      // heroImageUrl takes priority as first image, then imageUrls array
      let imageUrls: string[] = []
      
      // Parse imageUrls JSON field (can be array, string, or null)
      if (venueWithIncludes.imageUrls) {
        if (Array.isArray(venueWithIncludes.imageUrls)) {
          imageUrls = venueWithIncludes.imageUrls.filter((url: any): url is string => typeof url === 'string' && url.length > 0)
        } else if (typeof venueWithIncludes.imageUrls === 'string') {
          try {
            const parsed = JSON.parse(venueWithIncludes.imageUrls)
            if (Array.isArray(parsed)) {
              imageUrls = parsed.filter((url: any): url is string => typeof url === 'string' && url.length > 0)
            }
          } catch {
            // If parsing fails, treat as single URL string
            if (venueWithIncludes.imageUrls.length > 0) {
              imageUrls = [venueWithIncludes.imageUrls]
            }
          }
        }
      }
      
      // Add heroImageUrl as first image if it exists
      if (venueWithIncludes.heroImageUrl && typeof venueWithIncludes.heroImageUrl === 'string' && venueWithIncludes.heroImageUrl.length > 0) {
        imageUrls = [venueWithIncludes.heroImageUrl, ...imageUrls.filter((url: string) => url !== venueWithIncludes.heroImageUrl)]
      }

      // Compute dealBadge: use featured deal if exists, otherwise first active deal
      let dealBadge = null
      try {
        const primaryDeal = venueWithIncludes.deals && Array.isArray(venueWithIncludes.deals) && venueWithIncludes.deals.length > 0 ? venueWithIncludes.deals[0] : null
        if (primaryDeal && primaryDeal.title) {
          dealBadge = {
            title: primaryDeal.title || "",
            description: primaryDeal.description || "",
            type: primaryDeal.type || "",
            summary: formatDealBadgeSummary(primaryDeal),
          }
        }
      } catch (error) {
        console.error("Error computing dealBadge for venue:", venue.id, error)
        dealBadge = null
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
        dealBadge,
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
