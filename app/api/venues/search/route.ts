import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { formatDealBadgeSummary } from "@/lib/deal-utils"
import { computeAvailabilityLabel } from "@/lib/availability-utils"
import { getCanonicalVenueHours, getOpenStatus } from "@/lib/hours"

const DEBUG_LOG = (payload: { location: string; message: string; data?: Record<string, unknown>; hypothesisId?: string }) => {
  fetch("http://127.0.0.1:7242/ingest/b5111244-c4ed-4ea6-9398-28181fe79047", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, timestamp: Date.now(), sessionId: "debug-session" }),
  }).catch(() => {})
}

export async function GET(request: Request) {
  console.log("🔍 /api/venues/search route called")
  try {
    // #region agent log
    DEBUG_LOG({ location: "search/route.ts:entry", message: "GET search started", hypothesisId: "H2" })
    // #endregion
    // Get session for favorite state fetching
    const session = await auth()
    
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
    const favoritesOnly = searchParams.get("favoritesOnly") === "true"
    const availableNow = searchParams.get("availableNow") === "true"

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

    if (process.env.NODE_ENV !== "production") {
      console.log("[Explore API] bounds", { hasBounds: boundsValid, parsedBounds })
    }

    const now = new Date()
    const horizonEnd = new Date(now.getTime() + 12 * 60 * 60 * 1000)

    // Build where clause
    const whereClause: any = {}

    // Add bounds filter only when no text query (text search = full DB; area/initial = bounded)
    if (boundsValid && parsedBounds && q.length === 0) {
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

    // Add favoritesOnly filter (only if user is authenticated)
    if (favoritesOnly && session?.user?.id) {
      whereClause.favoriteVenues = {
        some: {
          userId: session.user.id,
        },
      }
      console.log("✅ Applied favoritesOnly filter to whereClause")
    } else if (favoritesOnly && !session?.user?.id) {
      // If favoritesOnly is requested but user is not signed in, return empty results
      return NextResponse.json({ venues: [], favoritedVenueIds: [] })
    }

    // Only show APPROVED venues in search results
    whereClause.onboardingStatus = "APPROVED"
    // Exclude soft-deleted and paused venues from Explore
    whereClause.status = { not: "DELETED" }
    whereClause.pausedAt = null

    // #region agent log
    DEBUG_LOG({ location: "search/route.ts:beforeFindMany", message: "before prisma.venue.findMany", hypothesisId: "H2" })
    // #endregion
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
    // #region agent log
    DEBUG_LOG({ location: "search/route.ts:afterFindMany", message: "after findMany", data: { venueCount: venues.length, firstId: venues[0]?.id }, hypothesisId: "H2" })
    // #endregion
    
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

    // Helper function to round up to next 15 minutes
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

    // Resolve open status for each venue (single shared hours engine)
    // #region agent log
    DEBUG_LOG({ location: "search/route.ts:beforePromiseAll", message: "before Promise.all hours", data: { venueCount: venues.length }, hypothesisId: "H1,H5" })
    // #endregion
    let venuesWithOpenStatus = await Promise.all(
      venues.map(async (venue) => {
        // #region agent log
        DEBUG_LOG({ location: "search/route.ts:mapEntry", message: "venue map entry", data: { venueId: venue.id }, hypothesisId: "H1,H5" })
        // #endregion
        try {
          const canonical = await getCanonicalVenueHours(venue.id)
          // #region agent log
          DEBUG_LOG({ location: "search/route.ts:afterCanonical", message: "after getCanonicalVenueHours", data: { venueId: venue.id, hasCanonical: !!canonical }, hypothesisId: "H1,H5" })
          // #endregion
          const openStatus = canonical ? getOpenStatus(canonical, now) : null
          // #region agent log
          DEBUG_LOG({ location: "search/route.ts:afterOpenStatus", message: "after getOpenStatus", data: { venueId: venue.id }, hypothesisId: "H1" })
          // #endregion
          return { venue, openStatus, timezone: canonical?.timezone ?? null }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          // #region agent log
          DEBUG_LOG({ location: "search/route.ts:mapCatch", message: "hours catch", data: { venueId: venue.id, error: msg }, hypothesisId: "H1,H5" })
          // #endregion
          console.error("[Explore API] hours for venue", venue.id, err)
          return { venue, openStatus: null, timezone: null }
        }
      })
    )
    // #region agent log
    DEBUG_LOG({ location: "search/route.ts:afterPromiseAll", message: "after Promise.all", data: { count: venuesWithOpenStatus.length }, hypothesisId: "H1" })
    // #endregion

    // Apply "Available Now" filter if requested
    if (availableNow) {
      venuesWithOpenStatus = venuesWithOpenStatus.filter(({ venue, openStatus }) => {
        if (!openStatus?.isOpen) return false
        const venueWithIncludes = venue as any
        const capacity = venueWithIncludes.tables.reduce((sum: number, table: any) => {
          if (table.seats.length > 0) return sum + table.seats.length
          return sum + (table.seatCount || 0)
        }, 0)
        if (capacity <= 0) return false
        const startBase = roundUpToNext15Minutes(now)
        const windowEnd = new Date(startBase.getTime() + 60 * 60 * 1000)
        const venueReservations = reservationsByVenue[venue.id] || []
        const bookedSeats = venueReservations.reduce((sum, res) => {
          if (res.startAt < windowEnd && res.endAt > startBase) return sum + res.seatCount
          return sum
        }, 0)
        const availableSeats = capacity - bookedSeats
        if (seatCount !== null && !isNaN(seatCount) && seatCount > 0) {
          return availableSeats >= seatCount
        }
        return availableSeats > 0
      })
    }

    // Format venues for client
    // #region agent log
    DEBUG_LOG({ location: "search/route.ts:beforeFormat", message: "before formattedVenues.map", data: { inputCount: venuesWithOpenStatus.length }, hypothesisId: "H3" })
    // #endregion
    const formattedVenues = venuesWithOpenStatus.map(({ venue, openStatus, timezone }, idx) => {
      const venueWithIncludes = venue as any
      // #region agent log
      if (idx === 0) DEBUG_LOG({ location: "search/route.ts:formatFirst", message: "format first venue", data: { venueId: venue.id, hasTables: !!venueWithIncludes.tables }, hypothesisId: "H3" })
      // #endregion
      // Calculate capacity: use actual Seat records if available, otherwise fall back to table.seatCount
      const capacity = venueWithIncludes.tables.reduce((sum: number, table: any) => {
        if (table.seats.length > 0) {
          return sum + table.seats.length
        }
        // Fallback for older venues without Seat records
        return sum + (table.seatCount || 0)
      }, 0)
      
      // Cheapest price: min of (all seat prices from individual tables, all table total prices from group tables)
      const allSeatPrices = venueWithIncludes.tables
        .filter((t: any) => t.bookingMode === "individual")
        .flatMap((t: any) => (t.seats || []).map((s: any) => s.pricePerHour).filter((p: number) => p != null && p > 0))
      const allTablePrices = venueWithIncludes.tables
        .filter((t: any) => t.bookingMode === "group" && t.tablePricePerHour != null && t.tablePricePerHour > 0)
        .map((t: any) => t.tablePricePerHour)
      const candidatePrices = [...allSeatPrices, ...allTablePrices]
      const fallback = venue.hourlySeatPrice != null && venue.hourlySeatPrice > 0 ? venue.hourlySeatPrice : 0
      const minPrice = candidatePrices.length > 0 ? Math.min(...candidatePrices) : fallback
      const maxPrice = candidatePrices.length > 0 ? Math.max(...candidatePrices) : fallback
      
      const venueReservations = reservationsByVenue[venue.id] || []
      const availabilityLabel = computeAvailabilityLabel(
        capacity,
        venueReservations,
        openStatus,
        { timeZone: timezone ?? undefined }
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
        minPrice,
        maxPrice,
        hourlySeatPrice: minPrice,
        tags: venue.tags || [],
        capacity,
        rulesText: venue.rulesText || "",
        availabilityLabel,
        openStatus: openStatus
          ? { status: openStatus.status, todayHoursText: openStatus.todayHoursText }
          : null,
        imageUrls,
        dealBadge,
      }
    })

    // Fetch favorite states for all venues in batch
    let favoritedVenueIds: string[] = []
    if (session?.user?.id && formattedVenues.length > 0) {
      const venueIds = formattedVenues.map((v) => v.id)
      const favorites = await prisma.favoriteVenue.findMany({
        where: {
          userId: session.user.id,
          venueId: { in: venueIds },
        },
        select: {
          venueId: true,
        },
      })
      favoritedVenueIds = favorites.map((f: { venueId: string }) => f.venueId)
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[Explore API] response", {
        count: formattedVenues.length,
        first3Ids: formattedVenues.slice(0, 3).map((v) => v.id),
      })
    }

    // #region agent log
    DEBUG_LOG({ location: "search/route.ts:beforeJson", message: "before NextResponse.json", data: { formattedCount: formattedVenues.length }, hypothesisId: "H4" })
    // #endregion
    return NextResponse.json({ 
      venues: formattedVenues,
      favoritedVenueIds,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    // #region agent log
    DEBUG_LOG({ location: "search/route.ts:catch", message: "outer catch", data: { error: message, stack: (stack ?? "").slice(0, 200) }, hypothesisId: "H1,H2,H3,H4,H5" })
    // #endregion
    console.error("Error searching venues by bounds:", message, stack ?? "")
    return NextResponse.json(
      { error: "Failed to search venues. Please try again." },
      { status: 500 }
    )
  }
}
