/**
 * Helper functions for venue operations console
 */

export interface Reservation {
  id: string
  startAt: Date | string
  endAt: Date | string
  status: string
  seatId?: string | null
  tableId?: string | null
  seatCount: number
  userId?: string | null
  user?: {
    email?: string | null
  } | null
  seat?: {
    label?: string | null
    table?: {
      name?: string | null
    } | null
  } | null
  table?: {
    name?: string | null
  } | null
}

export interface SeatBlock {
  id: string
  seatId?: string | null
  startAt: Date | string
  endAt: Date | string
  reason?: string | null
}

/**
 * Check if a reservation is currently active (happening now)
 */
export function isReservationActive(
  reservation: Reservation,
  now: Date = new Date()
): boolean {
  const start = typeof reservation.startAt === "string" ? new Date(reservation.startAt) : reservation.startAt
  const end = typeof reservation.endAt === "string" ? new Date(reservation.endAt) : reservation.endAt
  return start <= now && now < end && reservation.status !== "cancelled"
}

/**
 * Check if a seat is blocked at a given time
 */
export function isSeatBlocked(
  seatId: string,
  blocks: SeatBlock[],
  now: Date = new Date()
): boolean {
  return blocks.some((block) => {
    if (block.seatId !== seatId) return false
    const start = typeof block.startAt === "string" ? new Date(block.startAt) : block.startAt
    const end = typeof block.endAt === "string" ? new Date(block.endAt) : block.endAt
    return start <= now && now < end
  })
}

/**
 * Get reservation status relative to current time
 */
export function getReservationStatus(
  reservation: Reservation,
  now: Date = new Date()
): "now" | "upcoming" | "past" | "cancelled" {
  if (reservation.status === "cancelled") return "cancelled"

  const start = typeof reservation.startAt === "string" ? new Date(reservation.startAt) : reservation.startAt
  const end = typeof reservation.endAt === "string" ? new Date(reservation.endAt) : reservation.endAt

  if (start <= now && now < end) return "now"
  if (start > now) return "upcoming"
  return "past"
}

/**
 * Format time range for display (e.g., "2:00 PM – 4:00 PM")
 */
export function formatTimeRange(startAt: Date | string, endAt: Date | string): string {
  const start = typeof startAt === "string" ? new Date(startAt) : startAt
  const end = typeof endAt === "string" ? new Date(endAt) : endAt

  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })

  return `${timeFormatter.format(start)} – ${timeFormatter.format(end)}`
}

/**
 * Format date for display (e.g., "Mon, Jan 22")
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d)
}

/**
 * Check if a date is today
 */
export function isToday(date: Date | string): boolean {
  const d = typeof date === "string" ? new Date(date) : date
  const today = new Date()
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  )
}

/**
 * Group reservations by time period
 */
export function groupReservationsByTime(
  reservations: Reservation[],
  now: Date = new Date()
): {
  now: Reservation[]
  today: Reservation[]
  next: Reservation[]
} {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const nextWeek = new Date(today)
  nextWeek.setDate(nextWeek.getDate() + 7)

  const result = {
    now: [] as Reservation[],
    today: [] as Reservation[],
    next: [] as Reservation[],
  }

  for (const reservation of reservations) {
    const start = typeof reservation.startAt === "string" ? new Date(reservation.startAt) : reservation.startAt
    const end = typeof reservation.endAt === "string" ? new Date(reservation.endAt) : reservation.endAt

    // "Now" - currently active
    if (isReservationActive(reservation, now)) {
      result.now.push(reservation)
      continue
    }

    // "Today" - starts today but not currently active
    if (start >= today && start < new Date(today.getTime() + 24 * 60 * 60 * 1000)) {
      result.today.push(reservation)
      continue
    }

    // "Next" - within next 7 days
    if (start >= today && start < nextWeek) {
      result.next.push(reservation)
    }
  }

  return result
}

/**
 * Get seat display label
 */
export function getSeatLabel(seat: { label?: string | null; position?: number | null } | null | undefined): string {
  if (!seat) return "Unknown seat"
  if (seat.label) return seat.label
  if (seat.position) return `Seat ${seat.position}`
  return "Seat"
}

/**
 * Get reservation seat/table display text
 */
export function getReservationSeatInfo(reservation: Reservation): string {
  if (reservation.seatId && reservation.seat) {
    const seatLabel = getSeatLabel(reservation.seat)
    const tableName = reservation.seat.table?.name || "Table"
    return `${seatLabel} at ${tableName}`
  }
  if (reservation.tableId && reservation.table) {
    return `${reservation.seatCount} seat${reservation.seatCount > 1 ? "s" : ""} at ${reservation.table.name || "Table"}`
  }
  return `${reservation.seatCount} seat${reservation.seatCount > 1 ? "s" : ""}`
}

/**
 * Get booker display text
 */
export function getBookerDisplay(reservation: Reservation): string {
  if (reservation.user?.email) {
    return reservation.user.email
  }
  if (reservation.userId) {
    return `Guest ${reservation.userId.slice(0, 8)}`
  }
  return "Guest"
}
