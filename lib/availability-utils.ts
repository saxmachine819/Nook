import { isVenueOpenNow, getNextOpenTime } from "./venue-hours"

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

export function computeAvailabilityLabel(
  capacity: number,
  reservations: { startAt: Date; endAt: Date; seatCount: number }[],
  venueHours?: Array<{
    dayOfWeek: number
    isClosed: boolean
    openTime: string | null
    closeTime: string | null
  }> | null,
  openingHoursJson?: any
): string {
  // If no capacity, always sold out
  if (capacity <= 0) return "Sold out for now"

  const now = new Date()

  // Check if venue is currently open
  const openStatus = isVenueOpenNow(openingHoursJson, undefined, venueHours)

  // If we can't determine open status and have no hours data, assume open (backward compatibility)
  if (!openStatus.canDetermine && !venueHours && !openingHoursJson) {
    // Fall back to original logic - check availability based on reservations only
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

  // Venue is closed - find when it opens next
  if (!openStatus.isOpen) {
    const nextOpenTime = getNextOpenTime(venueHours, openingHoursJson)
    
    // If getNextOpenTime returns null, it might mean the venue is actually open
    // (defensive check in getNextOpenTime). Re-check open status to be sure.
    if (!nextOpenTime) {
      // Double-check: if we have hours data and getNextOpenTime returned null,
      // it might be because the venue is actually open (bug in isVenueOpenNow)
      // In that case, fall through to open logic
      if (venueHours || openingHoursJson) {
        // Re-check one more time - if still can't determine, show "Currently Closed"
        const recheck = isVenueOpenNow(openingHoursJson, undefined, venueHours)
        if (recheck.isOpen) {
          // Venue is actually open - fall through to open logic below
        } else {
          return "Currently Closed"
        }
      } else {
        return "Currently Closed"
      }
    } else {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const nextOpenDate = new Date(nextOpenTime)
      nextOpenDate.setHours(0, 0, 0, 0)

      const isToday = nextOpenDate.getTime() === today.getTime()
      const isTomorrow = nextOpenDate.getTime() === today.getTime() + 24 * 60 * 60 * 1000

      if (isToday) {
        return `Opens at ${formatTimeLabel(nextOpenTime)}`
      } else if (isTomorrow) {
        return `Opens tomorrow at ${formatTimeLabel(nextOpenTime)}`
      } else {
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        const dayName = dayNames[nextOpenTime.getDay()]
        return `Opens ${dayName} at ${formatTimeLabel(nextOpenTime)}`
      }
    }
  }

  // Venue is open - check availability considering reservations
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
      return `Next availability @ ${formatTimeLabel(windowStart)}`
    }
  }

  return "Sold out for now"
}
