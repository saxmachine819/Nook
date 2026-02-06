import { prisma } from "@/lib/prisma"

/**
 * Error thrown when a venue cannot be booked (deleted, paused, or owner deleted).
 * API routes can map this to 403 with a clear message.
 */
export class BookingNotAllowedError extends Error {
  code: "VENUE_DELETED" | "VENUE_PAUSED" | "OWNER_DELETED" | "RESOURCE_DISABLED" | "VENUE_NOT_FOUND"
  /** Optional message to show to user (e.g. venue's pauseMessage). */
  publicMessage?: string

  constructor(
    message: string,
    code: BookingNotAllowedError["code"],
    publicMessage?: string
  ) {
    super(message)
    this.name = "BookingNotAllowedError"
    this.code = code
    this.publicMessage = publicMessage
  }
}

export type CanBookVenueOptions = {
  userId?: string
  timeRange?: { startAt: Date; endAt: Date }
  seatId?: string
  tableId?: string
}

/**
 * Validates that a venue can accept bookings. Throws BookingNotAllowedError if not.
 * Use before creating a reservation or when returning availability.
 */
export async function canBookVenue(
  venueId: string,
  options: CanBookVenueOptions = {}
): Promise<void> {
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    include: {
      owner: {
        select: { id: true, status: true },
      },
    },
  })

  if (!venue) {
    throw new BookingNotAllowedError("Venue not found.", "VENUE_NOT_FOUND")
  }

  if (venue.status === "DELETED" || venue.deletedAt != null) {
    throw new BookingNotAllowedError(
      "This venue is no longer available for booking.",
      "VENUE_DELETED"
    )
  }

  if (venue.status === "PAUSED") {
    throw new BookingNotAllowedError(
      venue.pauseMessage || "This venue is temporarily not accepting reservations.",
      "VENUE_PAUSED",
      venue.pauseMessage || "This venue is temporarily not accepting reservations."
    )
  }

  if (venue.owner && venue.owner.status === "DELETED") {
    throw new BookingNotAllowedError(
      "This venue is not accepting reservations.",
      "OWNER_DELETED"
    )
  }

  if (options.seatId) {
    const seat = await prisma.seat.findUnique({
      where: { id: options.seatId },
      include: { table: { select: { venueId: true, isActive: true } } },
    })
    if (!seat || seat.table.venueId !== venueId) {
      throw new BookingNotAllowedError("Seat not found.", "VENUE_NOT_FOUND")
    }
    if (!seat.isActive || !seat.table.isActive) {
      throw new BookingNotAllowedError(
        "This seat or table is no longer available.",
        "RESOURCE_DISABLED"
      )
    }
  }

  if (options.tableId) {
    const table = await prisma.table.findUnique({
      where: { id: options.tableId },
      select: { venueId: true, isActive: true },
    })
    if (!table || table.venueId !== venueId) {
      throw new BookingNotAllowedError("Table not found.", "VENUE_NOT_FOUND")
    }
    if (!table.isActive) {
      throw new BookingNotAllowedError(
        "This table is no longer available.",
        "RESOURCE_DISABLED"
      )
    }
  }
}

/**
 * Returns venue bookability info without throwing. Use for availability endpoint
 * when you want to return 200 with bookingDisabled + pauseMessage for PAUSED venues.
 */
export async function getVenueBookability(venueId: string): Promise<{
  canBook: boolean
  reason?: string
  pauseMessage?: string
  status: "ACTIVE" | "PAUSED" | "DELETED"
}> {
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    include: {
      owner: { select: { status: true } },
    },
  })

  if (!venue) {
    return { canBook: false, reason: "Venue not found.", status: "DELETED" }
  }

  if (venue.status === "DELETED" || venue.deletedAt != null) {
    return {
      canBook: false,
      reason: "This venue is no longer available.",
      status: "DELETED",
    }
  }

  if (venue.status === "PAUSED") {
    return {
      canBook: false,
      reason: venue.pauseMessage || "Temporarily not accepting reservations.",
      pauseMessage: venue.pauseMessage ?? undefined,
      status: "PAUSED",
    }
  }

  if (venue.owner?.status === "DELETED") {
    return {
      canBook: false,
      reason: "This venue is not accepting reservations.",
      status: "ACTIVE",
    }
  }

  return { canBook: true, status: "ACTIVE" }
}
