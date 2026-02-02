import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  getCanonicalVenueHours,
  isReservationWithinCanonicalHours,
  getSlotTimesForDate,
} from "@/lib/hours"
import { getVenueBookability } from "@/lib/booking-guard"

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

      const bookability = await getVenueBookability(venueId)
      if (bookability.status === "DELETED") {
        return NextResponse.json({ error: "Venue not found." }, { status: 404 })
      }
      const bookingDisabled = !bookability.canBook
      const pauseMessage = bookability.pauseMessage ?? null

      // Calculate total capacity: only active tables/seats; use actual Seat records if available, otherwise fall back to table.seatCount
      const totalCapacity = venue.tables.reduce((sum, table) => {
        if ((table as any).isActive === false) return sum
        const activeSeats = table.seats.filter((s: any) => s.isActive !== false)
        if (activeSeats.length > 0) {
          return sum + activeSeats.length
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
            bookingDisabled,
            pauseMessage,
          },
          { status: 200 }
        )
      }

      // Validate time window against canonical hours (single shared hours engine)
      const canonical = await getCanonicalVenueHours(venueId)
      if (!canonical) {
        return NextResponse.json(
          { error: "Venue not found." },
          { status: 404 }
        )
      }
      const hoursCheck = isReservationWithinCanonicalHours(parsedStart, parsedEnd, canonical)
      if (!hoursCheck.isValid) {
        return NextResponse.json(
          {
            availableSeats: [],
            unavailableSeatIds: [],
            error: hoursCheck.error ?? "This venue isn't open at this time. Please check opening hours.",
            bookingDisabled,
            pauseMessage,
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

      console.log(`📊 Processing ${venue.tables.length} tables for venue ${venue.id}`)
      venue.tables.forEach((table) => {
        if ((table as any).isActive === false) return
        const bookingMode = (table as any).bookingMode || "individual"
        const tablePricePerHour = (table as any).tablePricePerHour
        console.log(`📋 Table "${table.name || 'unnamed'}" (id: ${table.id}): bookingMode=${bookingMode}, tablePricePerHour=${tablePricePerHour}, seats=${table.seats.length}`)
        
        // Skip seats from group tables - they should only appear as group table options
        if (bookingMode === "group") {
          console.log(`⏭️ Skipping seats from group table "${table.name || 'unnamed'}" - will be added to group tables list`)
          return // Don't add seats from group tables to allAvailableSeats
        }
        
        const tableImageUrls = Array.isArray(table.imageUrls)
          ? table.imageUrls
          : table.imageUrls
          ? typeof table.imageUrls === "string"
            ? JSON.parse(table.imageUrls)
            : table.imageUrls
          : []

        const isCommunal = (table as any).isCommunal || false

        table.seats.forEach((seat) => {
          if ((seat as any).isActive === false) return
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

      console.log(`\n🔍 BUILDING GROUP TABLES - Processing ${venue.tables.length} tables`)
      venue.tables.forEach((table) => {
        if ((table as any).isActive === false) return
        const bookingMode = (table as any).bookingMode || "individual"
        const tablePricePerHour = (table as any).tablePricePerHour
        const rawBookingMode = (table as any).bookingMode
        console.log(`  Table "${table.name || 'unnamed'}" (id: ${table.id}):`)
        console.log(`    - Raw bookingMode from DB: ${rawBookingMode} (type: ${typeof rawBookingMode})`)
        console.log(`    - Resolved bookingMode: ${bookingMode}`)
        console.log(`    - tablePricePerHour: ${tablePricePerHour} (type: ${typeof tablePricePerHour})`)
        console.log(`    - seatCount: ${table.seats.length}`)
        
        if (bookingMode === "group") {
          console.log(`    ✅ This is a GROUP table`)
          // Only include group tables that have tablePricePerHour set
          if (!tablePricePerHour || tablePricePerHour <= 0) {
            // Skip this table - it's misconfigured as a group table without a price
            console.log(`    ⚠️ SKIPPING - tablePricePerHour is missing or invalid: ${tablePricePerHour}`)
            return
          }
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
            pricePerHour: tablePricePerHour,
            imageUrls: tableImageUrls,
            isCommunal: isCommunal,
          })
          console.log(`    ✅ ADDED to availableGroupTables array`)
        } else {
          console.log(`    ℹ️ Not a group table (bookingMode="${bookingMode}")`)
        }
      })
      console.log(`\n📊 RESULT: ${availableGroupTables.length} group table(s) added to array`)
      if (availableGroupTables.length > 0) {
        availableGroupTables.forEach((t, i) => {
          console.log(`  [${i}] "${t.name}" - $${t.pricePerHour}/hour (${t.seatCount} seats)`)
        })
      }

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
        console.log(`\n🔍 FILTERING GROUP TABLES (seatCount=1):`)
        console.log(`  - Total group tables before filtering: ${availableGroupTables.length}`)
        console.log(`  - Unavailable group table IDs: ${Array.from(unavailableGroupTableIds).join(', ') || '(none)'}`)
        
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
        
        console.log(`  - Available after filtering: ${availableGroupTablesFiltered.length}`)
        console.log(`  - Unavailable: ${unavailableGroupTables.length}`)
        console.log(`\n📤 RETURNING RESPONSE with availableGroupTables: ${availableGroupTablesFiltered.length}`)
        
        return NextResponse.json(
          {
            availableSeats,
            unavailableSeats,
            availableSeatGroups: [],
            availableGroupTables: availableGroupTablesFiltered,
            unavailableGroupTables,
            unavailableSeatIds: Array.from(unavailableSeatIds),
            bookingDisabled,
            pauseMessage,
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
      console.log(`\n🔍 FILTERING GROUP TABLES (seatCount=${seatCount}):`)
      console.log(`  - Total group tables before filtering: ${availableGroupTables.length}`)
      console.log(`  - Requested seatCount: ${seatCount}`)
      console.log(`  - Unavailable group table IDs: ${Array.from(unavailableGroupTableIds).join(', ') || '(none)'}`)
      
      const availableGroupTablesFiltered = availableGroupTables.filter(
        (table) => table.seatCount >= seatCount && !unavailableGroupTableIds.has(table.id)
      )

      const unavailableGroupTables = availableGroupTables
        .filter(
          (table) => table.seatCount >= seatCount && unavailableGroupTableIds.has(table.id)
        )
        .map((table) => ({
          ...table,
          nextAvailableAt: calculateNextAvailableTimeForTable(
            table.id,
            parsedStart,
            parsedEnd
          ),
        }))
      
      console.log(`  - Available after filtering (seatCount=${seatCount}): ${availableGroupTablesFiltered.length}`)
      console.log(`  - Unavailable: ${unavailableGroupTables.length}`)
      if (availableGroupTables.length > 0) {
        availableGroupTables.forEach((t) => {
          console.log(`    - "${t.name}": ${t.seatCount} seats ${t.seatCount >= seatCount ? '✅ MATCHES (>=)' : '❌ too small'} requested ${seatCount}`)
        })
      }

      // For seatCount > 1, return groups AND group tables that match the seat count
      return NextResponse.json(
        {
          availableSeats: filteredAvailableSeats, // Filtered to exclude unavailable seats
          unavailableSeats: [], // No individual unavailable seats for multi-seat bookings
          availableSeatGroups,
          availableGroupTables: availableGroupTablesFiltered,
          unavailableGroupTables,
          unavailableSeatIds: Array.from(unavailableSeatIds),
          bookingDisabled,
          pauseMessage,
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

    // Slots from canonical hours (venue timezone); no raw Google payload
    const canonical = await getCanonicalVenueHours(venueId)
    if (!canonical) {
      return NextResponse.json({ error: "Venue not found." }, { status: 404 })
    }
    const slotTimes = getSlotTimesForDate(canonical, date)
    const dayStart = slotTimes[0]?.start
    const dayEnd = slotTimes[slotTimes.length - 1]?.end
    const reservations = dayStart && dayEnd
      ? venue.reservations.filter((r) => r.startAt < dayEnd && r.endAt > dayStart)
      : []

    const slots = slotTimes.map((slot) => {
      const bookedSeats = reservations.reduce((sum, r) => {
        if (r.startAt < slot.end && r.endAt > slot.start) return sum + r.seatCount
        return sum
      }, 0)
      const availableSeats = Math.max(capacity - bookedSeats, 0)
      return {
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        availableSeats,
        isFullyBooked: availableSeats <= 0,
      }
    })

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
