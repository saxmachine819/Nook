import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getOpenIntervalsFromVenueHours, isReservationWithinHours } from "@/lib/venue-hours"

type OpeningHoursPeriod = {
  open: { day: number; hour: number; minute: number }
  close?: { day: number; hour: number; minute: number }
}

function minutesSinceMidnight(hour: number, minute: number) {
  return hour * 60 + minute
}

// Returns booking intervals (in minutes since midnight) for the given local date.
// Prefers VenueHours if available, falls back to openingHoursJson, then default 8:00–20:00.
function getOpenIntervalsForDate(
  dateStr: string,
  venueHours: Array<{
    dayOfWeek: number
    isClosed: boolean
    openTime: string | null
    closeTime: string | null
  }> | null,
  openingHoursJson: any
): Array<{ startMin: number; endMin: number }> {
  // Fallback window (MVP)
  const fallback = [{ startMin: 8 * 60, endMin: 20 * 60 }]

  // Prefer VenueHours if available
  if (venueHours && venueHours.length > 0) {
    const intervals = getOpenIntervalsFromVenueHours(venueHours, dateStr)
    if (intervals.length > 0) {
      return intervals
    }
    // If day is closed, return empty array (no slots available)
    return []
  }

  // Fallback to openingHoursJson parsing
  const periods: OpeningHoursPeriod[] | undefined =
    openingHoursJson?.periods && Array.isArray(openingHoursJson.periods)
      ? openingHoursJson.periods
      : undefined

  if (!periods || periods.length === 0) return fallback

  const dayStart = new Date(`${dateStr}T00:00:00`)
  const weekday = dayStart.getDay() // 0=Sun ... 6=Sat

  const intervals: Array<{ startMin: number; endMin: number }> = []

  for (const p of periods) {
    if (!p?.open) continue
    const openDay = p.open.day
    const openMin = minutesSinceMidnight(p.open.hour, p.open.minute)
    const closeDay = p.close?.day
    const closeMin =
      p.close ? minutesSinceMidnight(p.close.hour, p.close.minute) : null

    // If the period starts today
    if (openDay === weekday) {
      // If no close, treat as open until end of day
      if (closeMin === null || closeDay === undefined) {
        intervals.push({ startMin: openMin, endMin: 24 * 60 })
        continue
      }

      // Close same day
      if (closeDay === weekday) {
        if (closeMin > openMin) {
          intervals.push({ startMin: openMin, endMin: closeMin })
        }
        continue
      }

      // Close next day (overnight): open until midnight for this day
      intervals.push({ startMin: openMin, endMin: 24 * 60 })
      continue
    }

    // If the period started yesterday and closes today (overnight spillover)
    const yesterday = (weekday + 6) % 7
    if (openDay === yesterday && closeDay === weekday && closeMin !== null) {
      intervals.push({ startMin: 0, endMin: closeMin })
    }
  }

  // If we couldn't map anything, fall back
  if (intervals.length === 0) return fallback

  // Normalize/clip and sort
  const normalized = intervals
    .map((i) => ({
      startMin: Math.max(0, Math.min(24 * 60, i.startMin)),
      endMin: Math.max(0, Math.min(24 * 60, i.endMin)),
    }))
    .filter((i) => i.endMin > i.startMin)
    .sort((a, b) => a.startMin - b.startMin)

  return normalized.length ? normalized : fallback
}

// Check if a time window falls within venue opening hours
function isTimeWindowWithinOpeningHours(
  startAt: Date,
  endAt: Date,
  venueHours: Array<{
    dayOfWeek: number
    isClosed: boolean
    openTime: string | null
    closeTime: string | null
  }> | null,
  openingHoursJson: any
): boolean {
  const result = isReservationWithinHours(startAt, endAt, venueHours, openingHoursJson)
  return result.isValid
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  const venueId = params.id

  const { searchParams } = new URL(request.url)
  const startAt = searchParams.get("startAt")
  const endAt = searchParams.get("endAt")
  const date = searchParams.get("date")
  const seatCountParam = searchParams.get("seatCount")
  const seatCount = seatCountParam ? parseInt(seatCountParam, 10) : 1

  // New seat-level availability endpoint (for /venue/[id] booking widget)
  if (startAt && endAt) {
    if (!startAt || !endAt) {
      return NextResponse.json(
        { error: "Missing required parameters: startAt and endAt (ISO strings)." },
        { status: 400 }
      )
    }

    const parsedStart = new Date(startAt)
    const parsedEnd = new Date(endAt)

    if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format. Use ISO strings." },
        { status: 400 }
      )
    }

    if (parsedEnd <= parsedStart) {
      return NextResponse.json(
        { error: "End time must be after start time." },
        { status: 400 }
      )
    }

    try {
      // Fetch venue with ALL tables and seats (both group and individual booking modes)
      const venue = await prisma.venue.findUnique({
        where: { id: venueId },
        include: {
          tables: {
            include: {
              seats: {
                orderBy: {
                  position: "asc",
                },
              },
            },
          },
          venueHours: {
            orderBy: {
              dayOfWeek: "asc",
            },
          },
        },
      })

      if (!venue) {
        return NextResponse.json({ error: "Venue not found." }, { status: 404 })
      }

      // Calculate total capacity: use actual Seat records if available, otherwise fall back to table.seatCount
      const totalCapacity = venue.tables.reduce((sum, table) => {
        if (table.seats.length > 0) {
          return sum + table.seats.length
        }
        // Fallback for older venues without Seat records
        return sum + (table.seatCount || 0)
      }, 0)

      // Validate requested seat count doesn't exceed capacity
      if (seatCount > totalCapacity) {
        return NextResponse.json(
          {
            availableSeats: [],
            availableSeatGroups: [],
            unavailableSeatIds: [],
            error: `This venue only has ${totalCapacity} seat${totalCapacity > 1 ? "s" : ""} available. Please select ${totalCapacity} or fewer seats.`,
          },
          { status: 200 }
        )
      }

      // Check if time window is within opening hours
      const openingHoursJson = (venue as any).openingHoursJson
      const venueHours = (venue as any).venueHours || null
      const hoursCheck = isReservationWithinHours(parsedStart, parsedEnd, venueHours, openingHoursJson)
      
      if (!hoursCheck.isValid) {
        return NextResponse.json(
          {
            availableSeats: [],
            unavailableSeatIds: [],
            error: hoursCheck.error || "This venue is not open during the requested time. Please check opening hours.",
          },
          { status: 200 }
        )
      }

      // Find overlapping reservations for this time window
      const overlappingReservations = await prisma.reservation.findMany({
        where: {
          venueId: venue.id,
          status: {
            not: "cancelled",
          },
          startAt: {
            lt: parsedEnd,
          },
          endAt: {
            gt: parsedStart,
          },
        },
        select: {
          seatId: true,
          tableId: true,
          endAt: true,
        },
      })

      // Find overlapping seat blocks for this time window
      const overlappingBlocks = await prisma.seatBlock.findMany({
        where: {
          venueId: venue.id,
          startAt: {
            lt: parsedEnd,
          },
          endAt: {
            gt: parsedStart,
          },
        },
        select: {
          seatId: true,
        },
      })

      // Get set of unavailable seat IDs from individual seat reservations
      const unavailableSeatIds = new Set(
        overlappingReservations
          .filter((r) => r.seatId !== null)
          .map((r) => r.seatId!)
      )

      // Add blocked seat IDs
      overlappingBlocks
        .filter((b) => b.seatId !== null)
        .forEach((b) => {
          unavailableSeatIds.add(b.seatId!)
        })

      // Handle venue-wide blocks (seatId === null) - block all seats
      const hasVenueWideBlock = overlappingBlocks.some((b) => b.seatId === null)
      if (hasVenueWideBlock) {
        // Block all seats in the venue
        venue.tables.forEach((table) => {
          table.seats.forEach((seat) => {
            unavailableSeatIds.add(seat.id)
          })
        })
      }

      // Check for group table reservations that block individual seats
      // When a group table is booked, ALL seats in that table become unavailable for individual booking
      const groupTableReservations = overlappingReservations.filter(
        (r) => r.tableId !== null && r.seatId === null
      )

      // Track unavailable group table IDs
      const unavailableGroupTableIds = new Set<string>()
      for (const groupReservation of groupTableReservations) {
        if (groupReservation.tableId) {
          unavailableGroupTableIds.add(groupReservation.tableId)
        }
        const table = venue.tables.find((t) => t.id === groupReservation.tableId)
        if (table) {
          table.seats.forEach((seat) => {
            unavailableSeatIds.add(seat.id)
          })
        }
      }

      // Build allAvailableSeats array from venue's tables and seats
      const allAvailableSeats: Array<{
        id: string
        tableId: string
        tableName: string | null
        label: string | null
        position: number | null
        pricePerHour: number
        tags: string[] | null
        imageUrls: string[] | null
        tableImageUrls: string[] | null
        isCommunal: boolean
      }> = []

      venue.tables.forEach((table) => {
        const tableImageUrls = Array.isArray(table.imageUrls)
          ? table.imageUrls
          : table.imageUrls
          ? typeof table.imageUrls === "string"
            ? JSON.parse(table.imageUrls)
            : table.imageUrls
          : []

        const isCommunal = (table as any).isCommunal || false

        table.seats.forEach((seat) => {
          const seatImageUrls = Array.isArray(seat.imageUrls)
            ? seat.imageUrls
            : seat.imageUrls
            ? typeof seat.imageUrls === "string"
              ? JSON.parse(seat.imageUrls)
              : seat.imageUrls
            : []

          const seatTags = Array.isArray(seat.tags)
            ? seat.tags
            : seat.tags
            ? typeof seat.tags === "string"
              ? JSON.parse(seat.tags)
              : seat.tags
            : []

          allAvailableSeats.push({
            id: seat.id,
            tableId: table.id,
            tableName: table.name,
            label: seat.label,
            position: seat.position,
            pricePerHour: seat.pricePerHour,
            tags: seatTags,
            imageUrls: seatImageUrls,
            tableImageUrls: tableImageUrls,
            isCommunal: isCommunal,
          })
        })
      })

      // Build availableGroupTables array (tables with bookingMode === "group")
      const availableGroupTables: Array<{
        id: string
        name: string | null
        seatCount: number
        pricePerHour: number
        imageUrls: string[]
        isCommunal: boolean
      }> = []

      venue.tables.forEach((table) => {
        const bookingMode = (table as any).bookingMode || "individual"
        if (bookingMode === "group") {
          const tablePricePerHour = (table as any).tablePricePerHour
          const tableImageUrls = Array.isArray(table.imageUrls)
            ? table.imageUrls
            : table.imageUrls
            ? typeof table.imageUrls === "string"
              ? JSON.parse(table.imageUrls)
              : table.imageUrls
            : []

          const isCommunal = (table as any).isCommunal || false

          availableGroupTables.push({
            id: table.id,
            name: table.name,
            seatCount: table.seats.length,
            pricePerHour: tablePricePerHour || table.seats.reduce((sum, s) => sum + s.pricePerHour, 0) / table.seats.length,
            imageUrls: tableImageUrls,
            isCommunal: isCommunal,
          })
        }
      })

      // Helper function to round up to next 15 minutes
      function roundUpToNext15Minutes(date: Date): Date {
        const result = new Date(date)
        const minutes = result.getMinutes()
        const remainder = minutes % 15
        if (remainder !== 0) {
          result.setMinutes(minutes + (15 - remainder), 0, 0)
        } else {
          result.setMinutes(minutes + 15, 0, 0)
        }
        return result
      }

      // Helper function to calculate next available time for a seat
      function calculateNextAvailableTimeForSeat(
        seatId: string,
        requestedStart: Date,
        requestedEnd: Date
      ): string | null {
        const seatReservations = overlappingReservations.filter(
          (r) => r.seatId === seatId && r.endAt
        )

        if (seatReservations.length === 0) return null

        const latestEnd = new Date(
          Math.max(...seatReservations.map((r) => r.endAt!.getTime()))
        )

        const rounded = roundUpToNext15Minutes(latestEnd)

        if (rounded <= requestedStart) return null

        return rounded.toISOString()
      }

      // Helper function to calculate next available time for a group table
      function calculateNextAvailableTimeForTable(
        tableId: string,
        requestedStart: Date,
        requestedEnd: Date
      ): string | null {
        const tableReservations = overlappingReservations.filter(
          (r) => r.tableId === tableId && r.seatId === null && r.endAt
        )

        if (tableReservations.length === 0) return null

        const latestEnd = new Date(
          Math.max(...tableReservations.map((r) => r.endAt!.getTime()))
        )

        const rounded = roundUpToNext15Minutes(latestEnd)

        if (rounded <= requestedStart) return null

        return rounded.toISOString()
      }

      // Helper function to find adjacent seats within available seats array
      function findAdjacentSeats(
        seats: typeof allAvailableSeats,
        count: number
      ): typeof allAvailableSeats | null {
        if (seats.length < count) return null

        // Sort by position (null positions go to end)
        const sorted = [...seats].sort((a, b) => {
          if (a.position === null && b.position === null) return 0
          if (a.position === null) return 1
          if (b.position === null) return -1
          return a.position - b.position
        })

        // Check for consecutive positions
        for (let i = 0; i <= sorted.length - count; i++) {
          const candidate = sorted.slice(i, i + count)
          const positions = candidate
            .map((s) => s.position)
            .filter((p): p is number => p !== null)
            .sort((a, b) => a - b)

          // Check if positions are consecutive
          if (positions.length === count) {
            let consecutive = true
            for (let j = 1; j < positions.length; j++) {
              if (positions[j] !== positions[j - 1] + 1) {
                consecutive = false
                break
              }
            }
            if (consecutive) return candidate
          }
        }

        return null
      }

      // If seatCount === 1, return all individual seats AND group tables that have at least 1 seat
      if (seatCount === 1) {
        // Split seats into available and unavailable
        const availableSeats = allAvailableSeats.filter(
          (seat) => !unavailableSeatIds.has(seat.id)
        )
        
        const unavailableSeats = allAvailableSeats
          .filter((seat) => unavailableSeatIds.has(seat.id))
          .map((seat) => ({
            ...seat,
            nextAvailableAt: calculateNextAvailableTimeForSeat(
              seat.id,
              parsedStart,
              parsedEnd
            ),
          }))

        // Split group tables into available and unavailable
        const availableGroupTablesFiltered = availableGroupTables.filter(
          (table) => !unavailableGroupTableIds.has(table.id)
        )

        const unavailableGroupTables = availableGroupTables
          .filter((table) => unavailableGroupTableIds.has(table.id))
          .map((table) => ({
            ...table,
            nextAvailableAt: calculateNextAvailableTimeForTable(
              table.id,
              parsedStart,
              parsedEnd
            ),
          }))
        
        return NextResponse.json(
          {
            availableSeats,
            unavailableSeats,
            availableSeatGroups: [],
            availableGroupTables: availableGroupTablesFiltered,
            unavailableGroupTables,
            unavailableSeatIds: Array.from(unavailableSeatIds),
          },
          { status: 200 }
        )
      }

      // If seatCount > 1, find groups of adjacent seats
      // First, filter out unavailable seats for grouping
      const filteredAvailableSeats = allAvailableSeats.filter(
        (seat) => !unavailableSeatIds.has(seat.id)
      )
      
      const availableSeatGroups: Array<{
        seats: typeof allAvailableSeats
        tableId: string
        totalPricePerHour: number
      }> = []

      // Group seats by table
      const seatsByTable = new Map<string, typeof allAvailableSeats>()
      filteredAvailableSeats.forEach((seat) => {
        if (!seatsByTable.has(seat.tableId)) {
          seatsByTable.set(seat.tableId, [])
        }
        seatsByTable.get(seat.tableId)!.push(seat)
      })

      // Find adjacent groups in each table
      seatsByTable.forEach((seats, tableId) => {
        const adjacentGroup = findAdjacentSeats(seats, seatCount)
        if (adjacentGroup && adjacentGroup.length === seatCount) {
          const totalPricePerHour = adjacentGroup.reduce(
            (sum, seat) => sum + seat.pricePerHour,
            0
          )
          availableSeatGroups.push({
            seats: adjacentGroup,
            tableId,
            totalPricePerHour,
          })
        }
      })

      // Split group tables into available and unavailable
      const availableGroupTablesFiltered = availableGroupTables.filter(
        (table) => table.seatCount === seatCount && !unavailableGroupTableIds.has(table.id)
      )

      const unavailableGroupTables = availableGroupTables
        .filter(
          (table) => table.seatCount === seatCount && unavailableGroupTableIds.has(table.id)
        )
        .map((table) => ({
          ...table,
          nextAvailableAt: calculateNextAvailableTimeForTable(
            table.id,
            parsedStart,
            parsedEnd
          ),
        }))

      // For seatCount > 1, return groups AND group tables that match the seat count
      return NextResponse.json(
        {
          availableSeats: filteredAvailableSeats, // Filtered to exclude unavailable seats
          unavailableSeats: [], // No individual unavailable seats for multi-seat bookings
          availableSeatGroups,
          availableGroupTables: availableGroupTablesFiltered,
          unavailableGroupTables,
          unavailableSeatIds: Array.from(unavailableSeatIds),
        },
        { status: 200 }
      )
    } catch (error) {
      console.error("Error fetching seat availability:", error)
      return NextResponse.json(
        { error: "Failed to fetch seat availability." },
        { status: 500 }
      )
    }
  }

  // Old slot-based availability endpoint (for VenueCard/InlineVenueBookingSheet)
  if (!date) {
    return NextResponse.json(
      { error: "Missing date parameter (YYYY-MM-DD)." },
      { status: 400 }
    )
  }

  try {
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      include: {
        tables: true,
        venueHours: {
          orderBy: {
            dayOfWeek: "asc",
          },
        },
        reservations: {
          where: {
            status: {
              not: "cancelled",
            },
          },
        },
      },
    })

    if (!venue) {
      return NextResponse.json({ error: "Venue not found." }, { status: 404 })
    }

    const capacity = venue.tables.reduce((sum, table) => sum + table.seatCount, 0)

    if (capacity <= 0) {
      return NextResponse.json(
        { error: "This venue has no reservable seats configured yet." },
        { status: 400 }
      )
    }

    // Build the day range in local time (MVP approximation)
    const dayStart = new Date(`${date}T00:00:00`)
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

    // Filter reservations that intersect this day
    const reservations = venue.reservations.filter(
      (r) => r.startAt < dayEnd && r.endAt > dayStart
    )

    // Define booking windows for slots from VenueHours (prefer) or Google opening hours (fallback to 8:00–20:00)
    const slots = []
    const venueHours = (venue as any).venueHours || null
    const openingHoursJson = (venue as any).openingHoursJson
    const openIntervals = getOpenIntervalsForDate(date, venueHours, openingHoursJson)

    for (const interval of openIntervals) {
      for (let m = interval.startMin; m < interval.endMin; m += 15) {
        const slotStart = new Date(dayStart)
        slotStart.setMinutes(m, 0, 0)

        const slotEnd = new Date(slotStart.getTime() + 15 * 60 * 1000)

        // Skip slots that start outside interval (e.g., last slot spills past close)
        if (slotEnd.getTime() > dayStart.getTime() + interval.endMin * 60 * 1000) {
          continue
        }

        // Overlap: existing.startAt < slotEnd AND existing.endAt > slotStart
        const bookedSeats = reservations.reduce((sum, r) => {
          if (r.startAt < slotEnd && r.endAt > slotStart) {
            return sum + r.seatCount
          }
          return sum
        }, 0)

        const availableSeats = Math.max(capacity - bookedSeats, 0)

        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          availableSeats,
          isFullyBooked: availableSeats <= 0,
        })
      }
    }

    return NextResponse.json(
      {
        capacity,
        slots,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching availability:", error)
    return NextResponse.json(
      { error: "Failed to fetch availability." },
      { status: 500 }
    )
  }
}
