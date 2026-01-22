import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      console.error("❌ No session found")
      return NextResponse.json(
        { error: "You must be signed in to make a reservation." },
        { status: 401 }
      )
    }

    if (!session.user.id) {
      console.error("❌ Session user missing id:", { user: session.user })
      return NextResponse.json(
        { error: "Authentication error: user ID not found." },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { venueId, seatId, seatIds, tableId, seatCount: requestedSeatCount, startAt, endAt } = body as {
      venueId?: string
      seatId?: string
      seatIds?: string[]
      tableId?: string
      seatCount?: number
      startAt?: string
      endAt?: string
    }

    // Support both individual seat bookings and group table bookings
    const finalSeatIds = seatIds || (seatId ? [seatId] : [])
    const isGroupBooking = tableId !== undefined && tableId !== null

    if (!venueId || (!isGroupBooking && finalSeatIds.length === 0) || !startAt || !endAt) {
      return NextResponse.json(
        { error: "Missing required fields: venueId, seatId(s) or tableId, startAt, endAt." },
        { status: 400 }
      )
    }

    if (isGroupBooking && !requestedSeatCount) {
      return NextResponse.json(
        { error: "seatCount is required for group table bookings." },
        { status: 400 }
      )
    }

    const parsedStart = new Date(startAt)
    const parsedEnd = new Date(endAt)

    if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
      return NextResponse.json(
        { error: "Invalid dates provided." },
        { status: 400 }
      )
    }

    if (parsedEnd <= parsedStart) {
      return NextResponse.json(
        { error: "End time must be after start time." },
        { status: 400 }
      )
    }

    // Verify user exists in database
    const userExists = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true },
    })

    if (!userExists) {
      console.error("❌ User not found in database:", {
        userId: session.user.id,
        email: session.user.email,
      })
      return NextResponse.json(
        { error: "User account not found. Please sign out and sign in again." },
        { status: 401 }
      )
    }

    let reservations: any[]

    if (isGroupBooking) {
      // Group table booking
      const table = await prisma.table.findUnique({
        where: { id: tableId },
        include: {
          venue: true,
          seats: true,
        },
      })

      if (!table) {
        return NextResponse.json(
          { error: "Table not found." },
          { status: 404 }
        )
      }

      if (table.venueId !== venueId) {
        return NextResponse.json(
          { error: "Table does not belong to this venue." },
          { status: 400 }
        )
      }

      if (table.bookingMode !== "group") {
        return NextResponse.json(
          { error: "This table is not available for group booking." },
          { status: 400 }
        )
      }

      if (table.seats.length < requestedSeatCount!) {
        return NextResponse.json(
          { error: `This table only has ${table.seats.length} seat${table.seats.length > 1 ? "s" : ""}.` },
          { status: 400 }
        )
      }

      // Check if table is available (no overlapping reservations for this table)
      const overlapping = await prisma.reservation.findFirst({
        where: {
          tableId: tableId,
          seatId: null, // Group bookings have no seatId
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
      })

      if (overlapping) {
        return NextResponse.json(
          { error: "This table is not available for that time." },
          { status: 409 }
        )
      }

      // Create a single reservation for the entire table
      const reservation = await prisma.reservation.create({
        data: {
          venueId: venueId,
          tableId: tableId,
          seatId: null, // Group bookings have no seatId
          userId: session.user.id,
          startAt: parsedStart,
          endAt: parsedEnd,
          seatCount: requestedSeatCount!,
          status: "active",
        },
        include: {
          venue: {
            include: {
              tables: {
                include: {
                  seats: true,
                },
              },
            },
          },
          table: {
            include: {
              seats: true,
            },
          },
          seat: true,
        },
      })

      reservations = [reservation]
    } else {
      // Individual seat booking
      // Fetch all seats and validate they exist and belong to venue
      const seats = await prisma.seat.findMany({
        where: {
          id: {
            in: finalSeatIds,
          },
        },
        include: {
          table: {
            include: {
              venue: true,
            },
          },
        },
      })

      if (seats.length !== finalSeatIds.length) {
        return NextResponse.json(
          { error: "One or more seats not found." },
          { status: 404 }
        )
      }

      // Validate all seats belong to the same venue
      for (const seat of seats) {
        if (seat.table.venueId !== venueId) {
          return NextResponse.json(
            { error: "One or more seats do not belong to this venue." },
            { status: 400 }
          )
        }
      }

      // Check per-seat availability: ensure no overlapping reservations for any of the seats
      const overlapping = await prisma.reservation.findFirst({
        where: {
          seatId: {
            in: finalSeatIds,
          },
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
      })

      if (overlapping) {
        return NextResponse.json(
          { error: "One or more seats are not available for that time." },
          { status: 409 }
        )
      }

      // NOTE: For MVP we use simple check-then-create. This is not fully concurrency safe.
      // TODO: Add transactional locking / seat hold logic to prevent race conditions.

      // Create a single reservation for all selected seats
      // Use the first seat's tableId and seatId as the primary reference
      const firstSeat = seats[0]
      const reservation = await prisma.reservation.create({
        data: {
          venueId: venueId,
          tableId: firstSeat.tableId,
          seatId: firstSeat.id, // Reference to first seat
          userId: session.user.id,
          startAt: parsedStart,
          endAt: parsedEnd,
          seatCount: finalSeatIds.length, // Total number of seats booked
          status: "active",
        },
        include: {
          venue: {
            include: {
              tables: {
                include: {
                  seats: true,
                },
              },
            },
          },
          table: {
            include: {
              seats: true,
            },
          },
          seat: true,
        },
      })

      reservations = [reservation]
    }

    // Calculate total price
    const hours =
      (parsedEnd.getTime() - parsedStart.getTime()) / (1000 * 60 * 60)
    
    let totalPricePerHour = 0
    let seatCountForAverage = 1
    
    if (isGroupBooking) {
      const table = await prisma.table.findUnique({
        where: { id: tableId },
        include: {
          seats: true,
        },
      })
      totalPricePerHour = table?.tablePricePerHour || 0
      seatCountForAverage = table?.seats.length || 1
    } else {
      // For individual seat bookings, sum all selected seat prices
      const seats = await prisma.seat.findMany({
        where: { id: { in: finalSeatIds } },
      })
      totalPricePerHour = seats.reduce(
        (sum, seat) => sum + seat.pricePerHour,
        0
      )
      seatCountForAverage = finalSeatIds.length
    }

    // Return the reservation (now always a single reservation)
    // The confirmation modal will show the total price
    const reservation = reservations[0]
    const reservationWithPricing = {
      ...reservation,
      venue: {
        ...reservation.venue,
        averageSeatPrice: totalPricePerHour / seatCountForAverage, // Average for display
      },
    }

    return NextResponse.json(
      {
        reservation: reservationWithPricing,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("❌ Error creating reservation:", error)
    console.error("Error details:", {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
      name: error?.name,
    })

    // Check for foreign key constraint errors
    if (error?.code === "P2003") {
      console.error("Foreign key constraint violation:", error?.meta)
      return NextResponse.json(
        {
          error: "User account not found. Please sign out and sign in again.",
          details:
            process.env.NODE_ENV === "development"
              ? {
                  message: error?.message,
                  code: error?.code,
                  meta: error?.meta,
                }
              : undefined,
        },
        { status: 401 }
      )
    }

    return NextResponse.json(
      {
        error: "Failed to create reservation. Please try again.",
        details:
          process.env.NODE_ENV === "development"
            ? {
                message: error?.message,
                code: error?.code,
                meta: error?.meta,
              }
            : undefined,
      },
      { status: 500 }
    )
  }
}
