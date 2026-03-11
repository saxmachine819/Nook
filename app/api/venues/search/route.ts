import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { formatDealBadgeSummary } from "@/lib/deal-utils"
import { computeAvailabilityLabel } from "@/lib/availability-utils"
import { batchGetCanonicalVenueHours, getOpenStatus } from "@/lib/hours"

export const revalidate = 30

export async function GET(request: Request) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)

    const north = searchParams.get("north")
    const south = searchParams.get("south")
    const east = searchParams.get("east")
    const west = searchParams.get("west")
    const q = searchParams.get("q")?.trim() || ""

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

    const anyBoundsProvided = north || south || east || west
    const allBoundsProvided = north && south && east && west

    if (anyBoundsProvided && !allBoundsProvided) {
      return NextResponse.json(
        { error: "Incomplete map bounds: north, south, east, west are all required" },
        { status: 400 }
      )
    }

    let boundsValid = false
    let parsedBounds: { north: number; south: number; east: number; west: number } | null = null

    if (allBoundsProvided) {
      const northNum = parseFloat(north)
      const southNum = parseFloat(south)
      const eastNum = parseFloat(east)
      const westNum = parseFloat(west)

      if (!isNaN(northNum) && !isNaN(southNum) && !isNaN(eastNum) && !isNaN(westNum) && northNum > southNum && eastNum > westNum) {
        boundsValid = true
        parsedBounds = { north: northNum, south: southNum, east: eastNum, west: westNum }
      } else {
        return NextResponse.json({ error: "Invalid map bounds provided" }, { status: 400 })
      }
    }

    const now = new Date()
    const horizonEnd = new Date(now.getTime() + 12 * 60 * 60 * 1000)

    const whereClause: any = {}

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

    if (q.length > 0) {
      const searchConditions: any[] = [
        { name: { contains: q, mode: "insensitive" as const } },
        { address: { contains: q, mode: "insensitive" as const } },
        { city: { contains: q, mode: "insensitive" as const } },
        { neighborhood: { contains: q, mode: "insensitive" as const } },
      ]
      whereClause.OR = searchConditions
    }

    if (tags.length > 0) {
      whereClause.tags = {
        hasSome: tags,
      }
    }

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

    if (dealsOnly) {
      whereClause.deals = {
        some: {
          isActive: true,
        },
      }
    }

    if (favoritesOnly && session?.user?.id) {
      whereClause.favoriteVenues = {
        some: {
          userId: session.user.id,
        },
      }
    } else if (favoritesOnly && !session?.user?.id) {
      return NextResponse.json({ venues: [], favoritedVenueIds: [] })
    }

    whereClause.onboardingStatus = "APPROVED"
    whereClause.status = { not: "DELETED" }
    whereClause.pausedAt = null

    const venues = await prisma.venue.findMany({
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
      include: {
        tables: {
          include: {
            seats: true,
          },
        },
        deals: {
          where: { isActive: true },
          orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
          take: 1,
        },
        venueHours: {
          orderBy: {
            dayOfWeek: "asc",
          },
        },
      } as any,
      take: 100,
      orderBy: q.length > 0 ? { name: "asc" } : { createdAt: "desc" },
    })

    let filteredVenues = venues

    if (q.length > 0) {
      const queryLower = q.toLowerCase()
      filteredVenues = filteredVenues.filter((venue) => {
        const matchedByOtherFields =
          venue.name.toLowerCase().includes(queryLower) ||
          venue.address?.toLowerCase().includes(queryLower) ||
          venue.city?.toLowerCase().includes(queryLower) ||
          venue.neighborhood?.toLowerCase().includes(queryLower)

        if (matchedByOtherFields) return true

        if (Array.isArray(venue.tags) && venue.tags.length > 0) {
          return venue.tags.some((tag: string) => tag.toLowerCase().includes(queryLower))
        }

        return false
      })
    }

    if (seatCount !== null && !isNaN(seatCount) && seatCount > 0) {
      filteredVenues = filteredVenues.filter((venue) => {
        const venueWithTables = venue as any
        const capacity = venueWithTables.tables.reduce((sum: number, table: any) => {
          if (table.seats.length > 0) {
            return sum + table.seats.length
          }
          return sum + (table.seatCount || 0)
        }, 0)
        return capacity >= seatCount
      })
    }

    if (bookingModes.length > 0) {
      filteredVenues = filteredVenues.filter((venue) => {
        const venueWithTables = venue as any
        return bookingModes.some((mode) => {
          if (mode === "communal") {
            return venueWithTables.tables.some((table: any) => table.isCommunal === true)
          } else if (mode === "full-table") {
            return venueWithTables.tables.some((table: any) => table.bookingMode === "group")
          }
          return false
        })
      })
    }

    const venueIds = filteredVenues.map((v) => v.id)

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

    const hoursMap = await batchGetCanonicalVenueHours(venueIds)

    let venuesWithOpenStatus = filteredVenues.map((venue) => {
      try {
        const canonical = hoursMap.get(venue.id) ?? null
        const openStatus = canonical ? getOpenStatus(canonical, now) : null
        return { venue, openStatus, timezone: canonical?.timezone ?? null }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error("[Explore API] hours for venue", venue.id, msg)
        return { venue, openStatus: null, timezone: null }
      }
    })

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

    const formattedVenues = venuesWithOpenStatus.map(({ venue, openStatus, timezone }) => {
      const venueWithIncludes = venue as any

      const capacity = venueWithIncludes.tables.reduce((sum: number, table: any) => {
        if (table.seats.length > 0) {
          return sum + table.seats.length
        }
        return sum + (table.seatCount || 0)
      }, 0)

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

      let imageUrls: string[] = []
      if (venueWithIncludes.imageUrls) {
        if (Array.isArray(venueWithIncludes.imageUrls)) {
          imageUrls = venueWithIncludes.imageUrls.filter((url: any): url is string => typeof url === "string" && url.length > 0)
        } else if (typeof venueWithIncludes.imageUrls === "string") {
          try {
            const parsed = JSON.parse(venueWithIncludes.imageUrls)
            if (Array.isArray(parsed)) {
              imageUrls = parsed.filter((url: any): url is string => typeof url === "string" && url.length > 0)
            }
          } catch {
            if (venueWithIncludes.imageUrls.length > 0) {
              imageUrls = [venueWithIncludes.imageUrls]
            }
          }
        }
      }

      if (venueWithIncludes.heroImageUrl && typeof venueWithIncludes.heroImageUrl === "string" && venueWithIncludes.heroImageUrl.length > 0) {
        imageUrls = [venueWithIncludes.heroImageUrl, ...imageUrls.filter((url: string) => url !== venueWithIncludes.heroImageUrl)]
      }

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
        timezone,
      }
    })

    let favoritedVenueIds: string[] = []
    if (session?.user?.id && formattedVenues.length > 0) {
      const venueIdsList = formattedVenues.map((v) => v.id)
      const favorites = await prisma.favoriteVenue.findMany({
        where: {
          userId: session.user.id,
          venueId: { in: venueIdsList },
        },
        select: {
          venueId: true,
        },
      })
      favoritedVenueIds = favorites.map((f: { venueId: string }) => f.venueId)
    }

    return NextResponse.json({
      venues: formattedVenues,
      favoritedVenueIds,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("Error searching venues by bounds:", message)
    return NextResponse.json(
      { error: "Failed to search venues. Please try again" },
      { status: 500 }
    )
  }
}
