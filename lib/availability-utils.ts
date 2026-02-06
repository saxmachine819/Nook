import type { OpenStatus } from "@/lib/hours"

export function roundUpToNext15Minutes(date: Date): Date {
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

function formatTimeLabel(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone && { timeZone }),
  }).format(date)
}

/** Get date parts (year, month, day) for a moment in a timezone. */
function getDatePartsInTimezone(at: Date, tz: string): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  })
  const parts = formatter.formatToParts(at)
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10)
  return { year: get("year"), month: get("month"), day: get("day") }
}

/** Get weekday 0-6 (Sun-Sat) for a moment in a timezone. */
function getWeekdayInTimezone(at: Date, tz: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  })
  const short = formatter.format(at)
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  }
  return map[short] ?? 0
}

export type ComputeAvailabilityLabelOptions = {
  /** Venue timezone (e.g. America/New_York). When provided, "opens at" time and today/tomorrow/day name use this zone. */
  timeZone?: string
}

/**
 * Compute availability label using the shared hours engine (getOpenStatus).
 * openStatus must come from getCanonicalVenueHours + getOpenStatus; no raw Google payload.
 * Pass options.timeZone (venue timezone) so the displayed time and today/tomorrow/day are correct regardless of server TZ.
 */
export function computeAvailabilityLabel(
  capacity: number,
  reservations: { startAt: Date; endAt: Date; seatCount: number }[],
  openStatus: OpenStatus | null,
  options?: ComputeAvailabilityLabelOptions
): string {
  if (capacity <= 0) return "Sold out for now"

  const now = new Date()
  const timeZone = options?.timeZone

  // No hours data: cannot determine open status
  if (!openStatus) {
    return "Currently Closed"
  }

  // Venue is closed - use nextOpenAt from engine
  if (!openStatus.isOpen) {
    const nextOpenTime = openStatus.nextOpenAt
    if (!nextOpenTime) {
      return "Currently Closed"
    }
    let isToday: boolean
    let isTomorrow: boolean
    let dayName: string
    if (timeZone) {
      const nowParts = getDatePartsInTimezone(now, timeZone)
      const nextParts = getDatePartsInTimezone(nextOpenTime, timeZone)
      const todayKey = `${nowParts.year}-${nowParts.month}-${nowParts.day}`
      const nextKey = `${nextParts.year}-${nextParts.month}-${nextParts.day}`
      isToday = todayKey === nextKey
      const tomorrowParts = getDatePartsInTimezone(
        new Date(now.getTime() + 24 * 60 * 60 * 1000),
        timeZone
      )
      const tomorrowKey = `${tomorrowParts.year}-${tomorrowParts.month}-${tomorrowParts.day}`
      isTomorrow = nextKey === tomorrowKey
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
      dayName = dayNames[getWeekdayInTimezone(nextOpenTime, timeZone)]
    } else {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const nextOpenDate = new Date(nextOpenTime)
      nextOpenDate.setHours(0, 0, 0, 0)
      isToday = nextOpenDate.getTime() === today.getTime()
      isTomorrow = nextOpenDate.getTime() === today.getTime() + 24 * 60 * 60 * 1000
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
      dayName = dayNames[nextOpenTime.getDay()]
    }
    if (isToday) {
      return `Opens at ${formatTimeLabel(nextOpenTime, timeZone)}`
    }
    if (isTomorrow) {
      return `Opens tomorrow at ${formatTimeLabel(nextOpenTime, timeZone)}`
    }
    return `Opens ${dayName} at ${formatTimeLabel(nextOpenTime, timeZone)}`
  }

  // Venue is open - check availability considering reservations
  const startBase = roundUpToNext15Minutes(now)
  const horizonMs = 12 * 60 * 60 * 1000
  const slotMs = 15 * 60 * 1000

  for (let offset = 0; offset < horizonMs; offset += slotMs) {
    const windowStart = new Date(startBase.getTime() + offset)
    const windowEnd = new Date(windowStart.getTime() + 60 * 60 * 1000)
    const bookedSeats = reservations.reduce((sum, res) => {
      if (res.startAt < windowEnd && res.endAt > windowStart) {
        return sum + res.seatCount
      }
      return sum
    }, 0)
    if (bookedSeats < capacity) {
      if (offset === 0) return "Available now"
      return `Next availability @ ${formatTimeLabel(windowStart, timeZone)}`
    }
  }

  return "Sold out for now"
}
