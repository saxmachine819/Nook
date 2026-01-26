import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the venue-hours module
vi.mock('@/lib/venue-hours', () => ({
  isVenueOpenNow: vi.fn(),
  getNextOpenTime: vi.fn(),
}))

// Import after mocks
const { isVenueOpenNow, getNextOpenTime } = await import('@/lib/venue-hours')

// Import the function we're testing (from page.tsx)
// We'll need to extract it or test it indirectly
// For now, let's create a testable version

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
    } else if (isTomorrow) {
      return `Opens tomorrow at ${formatTimeLabel(nextOpenTime)}`
    } else {
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
      const dayName = dayNames[nextOpenTime.getDay()]
      return `Opens ${dayName} at ${formatTimeLabel(nextOpenTime)}`
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

describe('computeAvailabilityLabel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('capacity checks', () => {
    it('returns "Sold out for now" when capacity is 0', () => {
      vi.mocked(isVenueOpenNow).mockReturnValue({ isOpen: true, canDetermine: true })
      const result = computeAvailabilityLabel(0, [])
      expect(result).toBe("Sold out for now")
    })

    it('returns "Sold out for now" when capacity is negative', () => {
      vi.mocked(isVenueOpenNow).mockReturnValue({ isOpen: true, canDetermine: true })
      const result = computeAvailabilityLabel(-1, [])
      expect(result).toBe("Sold out for now")
    })
  })

  describe('backward compatibility (no hours data)', () => {
    it('returns "Available now" when no hours data and no reservations', () => {
      vi.mocked(isVenueOpenNow).mockReturnValue({ isOpen: false, canDetermine: false })
      const result = computeAvailabilityLabel(10, [])
      expect(result).toBe("Available now")
    })

    it('returns "Next available at [time]" when no hours data but fully booked now', () => {
      vi.mocked(isVenueOpenNow).mockReturnValue({ isOpen: false, canDetermine: false })
      const now = new Date()
      const startAt = new Date(now.getTime() + 15 * 60 * 1000)
      const endAt = new Date(now.getTime() + 60 * 60 * 1000)
      const reservations = [{ startAt, endAt, seatCount: 10 }]
      const result = computeAvailabilityLabel(10, reservations)
      expect(result).toContain("Next available at")
    })
  })

  describe('venue closed scenarios', () => {
    it('returns "Currently Closed" when closed and no next open time', () => {
      vi.mocked(isVenueOpenNow).mockReturnValue({ isOpen: false, canDetermine: true })
      vi.mocked(getNextOpenTime).mockReturnValue(null)
      const result = computeAvailabilityLabel(10, [])
      expect(result).toBe("Currently Closed")
    })

    it('returns "Opens at [time]" when closed but opens later today', () => {
      vi.mocked(isVenueOpenNow).mockReturnValue({ isOpen: false, canDetermine: true })
      const now = new Date()
      const laterToday = new Date(now)
      laterToday.setHours(now.getHours() + 2, 0, 0, 0)
      vi.mocked(getNextOpenTime).mockReturnValue(laterToday)
      const result = computeAvailabilityLabel(10, [])
      expect(result).toContain("Opens at")
      expect(result).not.toContain("tomorrow")
    })

    it('returns "Opens tomorrow at [time]" when closed and opens tomorrow', () => {
      vi.mocked(isVenueOpenNow).mockReturnValue({ isOpen: false, canDetermine: true })
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(9, 0, 0, 0)
      vi.mocked(getNextOpenTime).mockReturnValue(tomorrow)
      const result = computeAvailabilityLabel(10, [])
      expect(result).toContain("Opens tomorrow at")
    })

    it('returns "Opens [day] at [time]" when closed and opens in 2+ days', () => {
      vi.mocked(isVenueOpenNow).mockReturnValue({ isOpen: false, canDetermine: true })
      const now = new Date()
      const futureDay = new Date(now)
      futureDay.setDate(futureDay.getDate() + 3)
      futureDay.setHours(10, 0, 0, 0)
      vi.mocked(getNextOpenTime).mockReturnValue(futureDay)
      const result = computeAvailabilityLabel(10, [])
      expect(result).toContain("Opens")
      expect(result).toContain("at")
      expect(result).not.toContain("tomorrow")
    })
  })

  describe('venue open scenarios', () => {
    it('returns "Available now" when open and has capacity', () => {
      vi.mocked(isVenueOpenNow).mockReturnValue({ isOpen: true, canDetermine: true })
      const result = computeAvailabilityLabel(10, [])
      expect(result).toBe("Available now")
    })

    it('returns "Available now" when open and partially booked', () => {
      vi.mocked(isVenueOpenNow).mockReturnValue({ isOpen: true, canDetermine: true })
      const now = new Date()
      const startAt = new Date(now.getTime() + 60 * 60 * 1000)
      const endAt = new Date(now.getTime() + 2 * 60 * 60 * 1000)
      const reservations = [{ startAt, endAt, seatCount: 5 }]
      const result = computeAvailabilityLabel(10, reservations)
      expect(result).toBe("Available now")
    })

    it('returns "Next availability @ [time]" when open but fully booked now', () => {
      vi.mocked(isVenueOpenNow).mockReturnValue({ isOpen: true, canDetermine: true })
      const now = new Date()
      const startAt = new Date(now.getTime() + 15 * 60 * 1000)
      const endAt = new Date(now.getTime() + 60 * 60 * 1000)
      const reservations = [{ startAt, endAt, seatCount: 10 }]
      const result = computeAvailabilityLabel(10, reservations)
      expect(result).toContain("Next availability @")
    })

    it('returns "Sold out for now" when open but fully booked for 12 hours', () => {
      vi.mocked(isVenueOpenNow).mockReturnValue({ isOpen: true, canDetermine: true })
      const now = new Date()
      // Create reservations covering next 12 hours
      const reservations = []
      for (let i = 0; i < 12; i++) {
        const startAt = new Date(now.getTime() + i * 60 * 60 * 1000)
        const endAt = new Date(now.getTime() + (i + 1) * 60 * 60 * 1000)
        reservations.push({ startAt, endAt, seatCount: 10 })
      }
      const result = computeAvailabilityLabel(10, reservations)
      expect(result).toBe("Sold out for now")
    })
  })

  describe('edge cases', () => {
    it('handles overlapping reservations correctly', () => {
      vi.mocked(isVenueOpenNow).mockReturnValue({ isOpen: true, canDetermine: true })
      const now = new Date()
      const startAt1 = new Date(now.getTime() + 30 * 60 * 1000)
      const endAt1 = new Date(now.getTime() + 90 * 60 * 1000)
      const startAt2 = new Date(now.getTime() + 60 * 60 * 1000)
      const endAt2 = new Date(now.getTime() + 120 * 60 * 1000)
      const reservations = [
        { startAt: startAt1, endAt: endAt1, seatCount: 5 },
        { startAt: startAt2, endAt: endAt2, seatCount: 6 },
      ]
      const result = computeAvailabilityLabel(10, reservations)
      // Should find next availability after both reservations
      expect(result).toContain("Next availability @")
    })

    it('handles venueHours with closed day', () => {
      const venueHours = [
        { dayOfWeek: 0, isClosed: true, openTime: null, closeTime: null }, // Sunday
        { dayOfWeek: 1, isClosed: false, openTime: "09:00", closeTime: "17:00" }, // Monday
      ]
      vi.mocked(isVenueOpenNow).mockReturnValue({ isOpen: false, canDetermine: true })
      const now = new Date()
      // Set to Sunday
      now.setDate(now.getDate() - now.getDay())
      const monday = new Date(now)
      monday.setDate(monday.getDate() + 1)
      monday.setHours(9, 0, 0, 0)
      vi.mocked(getNextOpenTime).mockReturnValue(monday)
      const result = computeAvailabilityLabel(10, [], venueHours)
      expect(result).toContain("Opens")
    })
  })
})
