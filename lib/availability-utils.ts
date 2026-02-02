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

function formatTimeLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

/**
 * Compute availability label using the shared hours engine (getOpenStatus).
 * openStatus must come from getCanonicalVenueHours + getOpenStatus; no raw Google payload.
 */
export function computeAvailabilityLabel(
  capacity: number,
  reservations: { startAt: Date; endAt: Date; seatCount: number }[],
  openStatus: OpenStatus | null
): string {
  if (capacity <= 0) return "Sold out for now"

  const now = new Date()

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
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const nextOpenDate = new Date(nextOpenTime)
    nextOpenDate.setHours(0, 0, 0, 0)
    const isToday = nextOpenDate.getTime() === today.getTime()
    const isTomorrow = nextOpenDate.getTime() === today.getTime() + 24 * 60 * 60 * 1000
    if (isToday) {
      return `Opens at ${formatTimeLabel(nextOpenTime)}`
    }
    if (isTomorrow) {
      return `Opens tomorrow at ${formatTimeLabel(nextOpenTime)}`
    }
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    const dayName = dayNames[nextOpenTime.getDay()]
    return `Opens ${dayName} at ${formatTimeLabel(nextOpenTime)}`
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
      return `Next availability @ ${formatTimeLabel(windowStart)}`
    }
  }

  return "Sold out for now"
}
