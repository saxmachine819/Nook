import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { ExploreClient } from "./ExploreClient"
import { formatDealBadgeSummary } from "@/lib/deal-utils"
import { getCanonicalVenueHours, getOpenStatus } from "@/lib/hours"
import { computeAvailabilityLabel } from "@/lib/availability-utils"

interface ExplorePageProps {
  searchParams: Promise<{ 
    q?: string
    dealsOnly?: string
    favoritesOnly?: string
    tags?: string
    priceMin?: string
    priceMax?: string
    seatCount?: string
    bookingMode?: string
  }>
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  try {
    // Get session for favorite state fetching
    const session = await auth()
    
    // Add early return for testing
    // return <ExploreClient venues={[]} />
    
    // Await searchParams in Next.js 14.2+
    const params = await searchParams
    
    const now = new Date()
    const horizonEnd = new Date(now.getTime() + 12 * 60 * 60 * 1000)
    const q = params?.q?.trim() || ""

    // Parse filter parameters from URL
    const dealsOnly = params?.dealsOnly === "true"
    const favoritesOnly = params?.favoritesOnly === "true"
    const tagsParam = params?.tags
    const tags = tagsParam ? tagsParam.split(",").filter(Boolean) : []
    const priceMin = params?.priceMin ? parseFloat(params.priceMin) : null
    const priceMax = params?.priceMax ? parseFloat(params.priceMax) : null
    const seatCountParam = params?.seatCount
    const seatCount = seatCountParam ? parseInt(seatCountParam, 10) : null
    const bookingModeParam = params?.bookingMode
    const bookingModes = bookingModeParam ? (bookingModeParam.split(",").filter(Boolean) as ("communal" | "full-table")[]) : []

    // Build where clause for search
    const whereClause: any = {}

    if (q.length > 0) {
      const searchConditions: any[] = [
        { name: { contains: q, mode: "insensitive" as const } },
        { address: { contains: q, mode: "insensitive" as const } },
        { city: { contains: q, mode: "insensitive" as const } },
        { neighborhood: { contains: q, mode: "insensitive" as const } },
      ]
      whereClause.OR = searchConditions
    }

    // Add tags filter
    if (tags.length > 0) {
      whereClause.tags = {
        hasSome: tags,
      }
    }

    // Add price filter
    if (priceMin !== null && !isNaN(priceMin)) {
      whereClause.hourlySeatPrice = {
        ...(whereClause.hourlySeatPrice || {}),
        gte: priceMin,
      }
    }
    if (priceMax !== null && !isNaN(priceMax)) {
      whereClause.hourlySeatPrice = {
        ...(whereClause.hourlySeatPrice || {}),
        lte: priceMax,
      }
    }

    // Add dealsOnly filter
    if (dealsOnly) {
      whereClause.deals = {
        some: { 
          isActive: true 
        }
      }
    }

    // Add favoritesOnly filter (only if user is authenticated)
    if (favoritesOnly && session?.user?.id) {
      whereClause.favoriteVenues = {
        some: {
          userId: session.user.id,
        },
      }
    } else if (favoritesOnly && !session?.user?.id) {
      // If favoritesOnly is requested but user is not signed in, return empty results
      return <ExploreClient venues={[]} favoritedVenueIds={new Set()} />
    }

    // Only show APPROVED venues in Explore
    whereClause.onboardingStatus = "APPROVED"
    // Exclude soft-deleted and paused venues from Explore
    whereClause.status = { not: "DELETED" }
    whereClause.pausedAt = null

    // Fetch venues from database (with optional search filter)
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
    }).catch((error) => {
      console.error("Error fetching venues:", error)
      return []
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

    // Filter by seatCount (minimum seats available)
    if (seatCount !== null && !isNaN(seatCount)) {
      venues = venues.filter((venue) => {
        const totalCapacity = venue.tables.reduce((sum, table) => {
          const tableWithSeats = table as any
          if (tableWithSeats.seats && tableWithSeats.seats.length > 0) {
            return sum + tableWithSeats.seats.length
          }
          return sum + (tableWithSeats.seatCount || 0)
        }, 0)
        return totalCapacity >= seatCount
      })
    }

    // Filter by bookingMode (communal or full-table)
    if (bookingModes.length > 0) {
      venues = venues.filter((venue) => {
        return venue.tables.some((table) => {
          const tableBookingMode = (table as any).bookingMode
          if (bookingModes.includes("communal") && tableBookingMode === "communal") {
            return true
          }
          if (bookingModes.includes("full-table") && tableBookingMode === "full-table") {
            return true
          }
          return false
        })
      })
    }

    const venueIds = venues.map((v) => v.id)

    // Fetch reservations for all venues in the next 12 hours (active only)
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

    // Pre-compute open status for all venues (can't await inside .map)
    const openStatusList = await Promise.all(
      venues.map(async (v) => {
        const canonical = await getCanonicalVenueHours(v.id)
        const openStatus = canonical ? getOpenStatus(canonical, now) : null
        return { venueId: v.id, openStatus }
      })
    )
    const openStatusByVenueId = Object.fromEntries(
      openStatusList.map(({ venueId, openStatus }) => [venueId, openStatus])
    )

    // Format venues for client component
    const formattedVenues = venues.map((venue) => {
      // Calculate capacity: use actual Seat records if available, otherwise fall back to table.seatCount
      const capacity = venue.tables.reduce((sum, table) => {
        const tableWithSeats = table as any
        if (tableWithSeats.seats && tableWithSeats.seats.length > 0) {
          return sum + tableWithSeats.seats.length
        }
        // Fallback for older venues without Seat records
        return sum + (tableWithSeats.seatCount || 0)
      }, 0)
      
      // Calculate price range based on booking modes
      // Min: cheapest individual seat price
      // Max: most expensive full table price (total, not per seat)
      const groupTables = venue.tables.filter(t => (t as any).bookingMode === "group")
      const individualTables = venue.tables.filter(t => (t as any).bookingMode === "individual")
      
      // Min price: cheapest individual seat
      let minPrice = venue.hourlySeatPrice || 0
      if (individualTables.length > 0) {
        const individualSeats = individualTables.flatMap(t => {
          const tableWithSeats = t as any
          return tableWithSeats.seats || []
        })
        const seatPrices = individualSeats
          .map(seat => (seat as any).pricePerHour)
          .filter(price => price && price > 0)
        if (seatPrices.length > 0) {
          minPrice = Math.min(...seatPrices)
        }
      }
      
      // Max price: most expensive full table (total table price)
      let maxPrice = venue.hourlySeatPrice || 0
      if (groupTables.length > 0) {
        const tablePrices = groupTables
          .map(t => (t as any).tablePricePerHour)
          .filter(price => price && price > 0)
        if (tablePrices.length > 0) {
          maxPrice = Math.max(...tablePrices)
        }
      }
      
      // If no group tables, max should be the most expensive individual seat
      if (groupTables.length === 0 && individualTables.length > 0) {
        const individualSeats = individualTables.flatMap(t => {
          const tableWithSeats = t as any
          return tableWithSeats.seats || []
        })
        const seatPrices = individualSeats
          .map(seat => (seat as any).pricePerHour)
          .filter(price => price && price > 0)
        if (seatPrices.length > 0) {
          maxPrice = Math.max(...seatPrices)
        }
      }
      
      // If no individual tables, min should be the cheapest group table per seat
      if (individualTables.length === 0 && groupTables.length > 0) {
        const perSeatPrices = groupTables
          .map(t => {
            const tableWithSeats = t as any
            const tablePrice = tableWithSeats.tablePricePerHour
            const seatCount = tableWithSeats.seats ? tableWithSeats.seats.length : 0
            if (tablePrice && tablePrice > 0 && seatCount > 0) {
              return tablePrice / seatCount
            }
            return null
          })
          .filter((price): price is number => price !== null)
        if (perSeatPrices.length > 0) {
          minPrice = Math.min(...perSeatPrices)
        }
      }
      
      const venueReservations = reservationsByVenue[venue.id] || []
      const openStatus = openStatusByVenueId[venue.id] ?? null
      const availabilityLabel = computeAvailabilityLabel(capacity, venueReservations, openStatus)

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

      // Compute dealBadge: use featured deal if exists, otherwise first active deal
      let dealBadge = null
      try {
        const venueWithDeals = venue as any
        const primaryDeal = venueWithDeals.deals && Array.isArray(venueWithDeals.deals) && venueWithDeals.deals.length > 0 ? venueWithDeals.deals[0] : null
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
        city: venue.city || "",
        state: venue.state || "",
        latitude: venue.latitude,
        longitude: venue.longitude,
        minPrice: minPrice,
        maxPrice: maxPrice,
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
    let favoritedVenueIds = new Set<string>()
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
      favoritedVenueIds = new Set(favorites.map((f) => f.venueId))
    }

    return <ExploreClient venues={[]} favoritedVenueIds={favoritedVenueIds} />
  } catch (error) {
    console.error("Error fetching venues:", error)
    return <ExploreClient venues={[]} />
  }
}
