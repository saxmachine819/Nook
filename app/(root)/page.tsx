import { prisma } from "@/lib/prisma"
import { ExploreClient } from "./ExploreClient"

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

export default async function ExplorePage() {
  try {
    const now = new Date()
    const horizonEnd = new Date(now.getTime() + 12 * 60 * 60 * 1000)

    // Fetch all venues from database
    const venues = await prisma.venue.findMany({
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

    // Format venues for client component
    const formattedVenues = venues.map((venue) => {
      // Calculate capacity: use actual Seat records if available, otherwise fall back to table.seatCount
      const capacity = venue.tables.reduce((sum, table) => {
        if (table.seats.length > 0) {
          return sum + table.seats.length
        }
        // Fallback for older venues without Seat records
        return sum + (table.seatCount || 0)
      }, 0)
      
      // Calculate price range based on booking modes
      // Min: cheapest individual seat price
      // Max: most expensive full table price (total, not per seat)
      const groupTables = venue.tables.filter(t => (t as any).bookingMode === "group")
      const individualTables = venue.tables.filter(t => (t as any).bookingMode === "individual")
      
      // Min price: cheapest individual seat
      let minPrice = venue.hourlySeatPrice || 0
      if (individualTables.length > 0) {
        const individualSeats = individualTables.flatMap(t => t.seats)
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
        const individualSeats = individualTables.flatMap(t => t.seats)
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
            const tablePrice = (t as any).tablePricePerHour
            const seatCount = t.seats.length
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
        imageUrls,
      }
    })

    return <ExploreClient venues={formattedVenues} />
  } catch (error) {
    console.error("Error fetching venues:", error)
    return <ExploreClient venues={[]} />
  }
}
