import { prisma } from "@/lib/prisma"
import { getCanonicalVenueHours, isReservationWithinCanonicalHours } from "@/lib/hours"
import { canBookVenue, BookingNotAllowedError } from "@/lib/booking-guard"

export type BookingPayload = {
  venueId?: string
  seatId?: string
  seatIds?: string[]
  tableId?: string
  seatCount?: number
  startAt?: string
  endAt?: string
}

type TableWithSeats = Awaited<ReturnType<typeof prisma.table.findUnique>> & {
  seats?: Awaited<ReturnType<typeof prisma.seat.findMany>>
}
type SeatWithTable = Awaited<ReturnType<typeof prisma.seat.findMany>>[number] & {
  table?: Awaited<ReturnType<typeof prisma.table.findUnique>> & { isActive?: boolean }
}

export type BookingContext = {
  venueId: string
  isGroupBooking: boolean
  finalSeatIds: string[]
  tableId: string | null
  requestedSeatCount: number | null
  parsedStart: Date
  parsedEnd: Date
  venue: Awaited<ReturnType<typeof prisma.venue.findUnique>>
  table: TableWithSeats | null
  seats: SeatWithTable[]
}

export type BookingPrice = {
  amountCents: number
  totalPricePerHour: number
  seatCountForAverage: number
  hours: number
}

const MS_PER_HOUR = 1000 * 60 * 60

export async function buildBookingContext(payload: BookingPayload, userId: string) {
  const { venueId, seatId, seatIds, tableId, seatCount, startAt, endAt } = payload

  const finalSeatIds = seatIds || (seatId ? [seatId] : [])
  const isGroupBooking = tableId !== undefined && tableId !== null

  if (!venueId || (!isGroupBooking && finalSeatIds.length === 0) || !startAt || !endAt) {
    throw new Error("Missing required fields: venueId, seatId(s) or tableId, startAt, endAt.")
  }

  if (isGroupBooking && !seatCount) {
    throw new Error("seatCount is required for group table bookings.")
  }

  const parsedStart = new Date(startAt)
  const parsedEnd = new Date(endAt)

  if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
    throw new Error("Invalid dates provided.")
  }

  if (parsedEnd <= parsedStart) {
    throw new Error("End time must be after start time.")
  }

  const now = new Date()
  if (parsedStart < now) {
    const error = new Error("This date/time is in the past. Please select a current or future time.")
    ;(error as any).code = "PAST_TIME"
    throw error
  }

  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    include: {
      venueHours: {
        orderBy: { dayOfWeek: "asc" },
      },
    },
  })

  if (!venue) {
    throw new Error("Venue not found.")
  }

  if (venue.onboardingStatus !== "APPROVED") {
    throw new Error("This venue is not available for booking.")
  }

  try {
    await canBookVenue(venueId, {
      userId,
      timeRange: { startAt: parsedStart, endAt: parsedEnd },
    })
  } catch (err) {
    if (err instanceof BookingNotAllowedError) {
      const error = new Error(err.publicMessage ?? err.message)
      ;(error as any).status = 403
      throw error
    }
    throw err
  }

  const canonical = await getCanonicalVenueHours(venueId)
  if (canonical && canonical.weeklyHours.length > 0) {
    const hoursCheck = isReservationWithinCanonicalHours(parsedStart, parsedEnd, canonical)
    if (!hoursCheck.isValid) {
      throw new Error(hoursCheck.error ?? "This venue isn't open at this time. Please check opening hours.")
    }
  }

  let table: TableWithSeats | null = null
  let seats: SeatWithTable[] = []

  if (isGroupBooking) {
    const seatWithSameId = await prisma.seat.findUnique({ where: { id: tableId! } })
    if (seatWithSameId) {
      throw new Error(
        "Invalid table ID. Did you mean to book a specific seat? Please select a table from the booking options."
      )
    }

    table = await prisma.table.findUnique({
      where: { id: tableId! },
      include: {
        venue: {
          include: {
            venueHours: { orderBy: { dayOfWeek: "asc" } },
          },
        },
        seats: true,
      },
    })

    if (!table) {
      throw new Error("Table not found.")
    }

    if (table.venueId !== venueId) {
      throw new Error("Table does not belong to this venue.")
    }

    if (table.isActive === false) {
      const error = new Error("This table is no longer available for booking.")
      ;(error as any).status = 403
      throw error
    }

    if (table.bookingMode !== "group") {
      throw new Error("This table is not available for group booking.")
    }

    const tableSeats = table.seats ?? []
    if (tableSeats.length < seatCount!) {
      throw new Error(`This table only has ${tableSeats.length} seat${tableSeats.length > 1 ? "s" : ""}.`)
    }

    const overlapping = await prisma.reservation.findFirst({
      where: {
        tableId: tableId!,
        seatId: null,
        status: { not: "cancelled" },
        startAt: { lt: parsedEnd },
        endAt: { gt: parsedStart },
      },
    })

    if (overlapping) {
      const error = new Error("This table is not available for that time.")
      ;(error as any).status = 409
      throw error
    }
  } else {
    seats = await prisma.seat.findMany({
      where: { id: { in: finalSeatIds } },
      include: {
        table: {
          include: {
            venue: { include: { venueHours: { orderBy: { dayOfWeek: "asc" } } } },
          },
        },
      },
    })

    if (seats.length !== finalSeatIds.length) {
      throw new Error("One or more seats not found.")
    }

    for (const seat of seats) {
      const seatTable = seat.table
      if (!seatTable || seatTable.venueId !== venueId) {
        throw new Error("One or more seats do not belong to this venue.")
      }
      if (seat.isActive === false || seatTable.isActive === false) {
        const error = new Error("One or more seats are no longer available for booking.")
        ;(error as any).status = 403
        throw error
      }
    }

    const overlapping = await prisma.reservation.findFirst({
      where: {
        seatId: { in: finalSeatIds },
        status: { not: "cancelled" },
        startAt: { lt: parsedEnd },
        endAt: { gt: parsedStart },
      },
    })

    if (overlapping) {
      const error = new Error("One or more seats are not available for that time.")
      ;(error as any).status = 409
      throw error
    }
  }

  return {
    venueId,
    isGroupBooking,
    finalSeatIds,
    tableId: tableId ?? null,
    requestedSeatCount: seatCount ?? null,
    parsedStart,
    parsedEnd,
    venue,
    table,
    seats,
  } satisfies BookingContext
}

export function computeBookingPrice(context: BookingContext): BookingPrice {
  const hours = (context.parsedEnd.getTime() - context.parsedStart.getTime()) / MS_PER_HOUR
  let totalPricePerHour = 0
  let seatCountForAverage = 1

  if (context.isGroupBooking) {
    totalPricePerHour = context.table?.tablePricePerHour || 0
    seatCountForAverage = (context.table as TableWithSeats | null)?.seats?.length || 1
  } else {
    totalPricePerHour = context.seats.reduce((sum, seat) => sum + seat.pricePerHour, 0)
    seatCountForAverage = context.finalSeatIds.length || 1
  }

  const totalAmount = totalPricePerHour * hours
  const amountCents = Math.max(0, Math.round(totalAmount * 100))

  return { amountCents, totalPricePerHour, seatCountForAverage, hours }
}

export async function createReservationFromContext(context: BookingContext, userId: string) {
  if (context.isGroupBooking) {
    const reservation = await prisma.reservation.create({
      data: {
        venueId: context.venueId,
        tableId: context.tableId,
        seatId: null,
        userId,
        startAt: context.parsedStart,
        endAt: context.parsedEnd,
        seatCount: context.requestedSeatCount ?? (context.table as TableWithSeats | null)?.seats?.length ?? 1,
        status: "active",
      },
      include: {
        venue: {
          include: {
            tables: { include: { seats: true } },
            owner: { select: { email: true } },
          },
        },
        table: {
          select: {
            id: true,
            name: true,
            seatCount: true,
            bookingMode: true,
            tablePricePerHour: true,
            directionsText: true,
            seats: true,
          },
        },
        seat: {
          include: {
            table: { select: { id: true, name: true, directionsText: true } },
          },
        },
      },
    })
    return reservation
  }

  const firstSeat = context.seats[0]
  const reservation = await prisma.reservation.create({
    data: {
      venueId: context.venueId,
      tableId: firstSeat?.tableId ?? null,
      seatId: firstSeat?.id ?? null,
      userId,
      startAt: context.parsedStart,
      endAt: context.parsedEnd,
      seatCount: context.finalSeatIds.length,
      status: "active",
    },
    include: {
      venue: {
        include: {
          tables: { include: { seats: true } },
          owner: { select: { email: true } },
        },
      },
      table: {
        select: {
          id: true,
          name: true,
          seatCount: true,
          bookingMode: true,
          tablePricePerHour: true,
          directionsText: true,
          seats: true,
        },
      },
      seat: {
        include: {
          table: { select: { id: true, name: true, directionsText: true } },
        },
      },
    },
  })
  return reservation
}
