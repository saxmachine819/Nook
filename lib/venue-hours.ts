/**
 * Venue Hours Utilities
 * 
 * Functions for parsing, formatting, and validating Google Places opening hours
 */

type GoogleOpeningHours = {
  weekdayDescriptions?: string[]
  periods?: Array<{
    open: {
      day: number // 0=Sunday, 1=Monday, ..., 6=Saturday
      hour: number
      minute: number
    }
    close?: {
      day: number
      hour: number
      minute: number
    }
  }>
}

type DayName = "Sunday" | "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday"
const DAY_NAMES: DayName[] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const DAY_ABBREVIATIONS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/**
 * Format time (hour, minute) to "HH:MM AM/PM" string
 */
function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM"
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  const displayMinute = minute.toString().padStart(2, "0")
  return `${displayHour}:${displayMinute} ${period}`
}

/**
 * Parse Google opening hours to human-readable format
 * Prefers weekdayDescriptions if available, otherwise formats from periods
 */
export function parseGoogleHours(openingHoursJson: any): {
  formatted: string[]
  hasHours: boolean
} {
  if (!openingHoursJson) {
    return { formatted: [], hasHours: false }
  }

  const hours = openingHoursJson as GoogleOpeningHours

  // Prefer weekdayDescriptions if available (human-readable format from Google)
  if (hours.weekdayDescriptions && Array.isArray(hours.weekdayDescriptions) && hours.weekdayDescriptions.length > 0) {
    return {
      formatted: hours.weekdayDescriptions,
      hasHours: true,
    }
  }

  // Fallback: parse from periods
  if (hours.periods && Array.isArray(hours.periods) && hours.periods.length > 0) {
    const dayMap = new Map<number, Array<{ open: string; close: string | null }>>()

    // Initialize all days as closed
    for (let i = 0; i < 7; i++) {
      dayMap.set(i, [])
    }

    // Process periods
    for (const period of hours.periods) {
      if (!period.open) continue

      const openDay = period.open.day
      const openTime = formatTime(period.open.hour, period.open.minute)

      if (!period.close) {
        // Open 24 hours
        dayMap.get(openDay)?.push({ open: openTime, close: null })
        continue
      }

      const closeDay = period.close.day
      const closeTime = formatTime(period.close.hour, period.close.minute)

      if (openDay === closeDay) {
        // Same day
        dayMap.get(openDay)?.push({ open: openTime, close: closeTime })
      } else {
        // Overnight period (e.g., Friday 10 PM - Saturday 2 AM)
        // Add to opening day as "openTime - 11:59 PM"
        dayMap.get(openDay)?.push({ open: openTime, close: "11:59 PM" })
        // Add to closing day as "12:00 AM - closeTime"
        dayMap.get(closeDay)?.push({ open: "12:00 AM", close: closeTime })
      }
    }

    // Format to strings
    const formatted: string[] = []
    for (let i = 0; i < 7; i++) {
      const intervals = dayMap.get(i) || []
      if (intervals.length === 0) {
        formatted.push(`${DAY_ABBREVIATIONS[i]}: Closed`)
      } else {
        const intervalStrs = intervals.map((interval) => {
          if (interval.close === null) {
            return `${interval.open} – 11:59 PM`
          }
          return `${interval.open} – ${interval.close}`
        })
        formatted.push(`${DAY_ABBREVIATIONS[i]}: ${intervalStrs.join(", ")}`)
      }
    }

    return {
      formatted,
      hasHours: true,
    }
  }

  return { formatted: [], hasHours: false }
}

/**
 * Check if venue is currently open based on venueHours or openingHoursJson
 * Prefers venueHours if available, falls back to openingHoursJson
 */
export function isVenueOpenNow(
  openingHoursJson?: any,
  timezone?: string,
  venueHours?: Array<{
    dayOfWeek: number
    isClosed: boolean
    openTime: string | null
    closeTime: string | null
  }> | null
): {
  isOpen: boolean
  canDetermine: boolean
} {
  const now = new Date()
  const currentDay = now.getDay() // 0=Sunday, ..., 6=Saturday
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  const currentMinutesSinceMidnight = currentHour * 60 + currentMinute

  // Prefer venueHours if available
  if (venueHours && venueHours.length > 0) {
    const todayHours = venueHours.find((h) => h.dayOfWeek === currentDay)
    if (todayHours) {
      if (todayHours.isClosed || !todayHours.openTime || !todayHours.closeTime) {
        // If venueHours says closed, but we have openingHoursJson, double-check with it
        // openingHoursJson from Google is more authoritative and may have more recent data
        if (openingHoursJson) {
          const jsonCheck = isVenueOpenNow(openingHoursJson, timezone, null)
          // If openingHoursJson says open, trust it over venueHours (Google data is more authoritative)
          if (jsonCheck.isOpen && jsonCheck.canDetermine) {
            return { isOpen: true, canDetermine: true }
          }
        }
        return { isOpen: false, canDetermine: true }
      }

      const openMinutes = timeToMinutes(todayHours.openTime)
      const closeMinutes = timeToMinutes(todayHours.closeTime)

      // Handle case where closeTime is "23:59" (should be treated as end of day)
      const actualCloseMinutes = todayHours.closeTime === "23:59" ? 24 * 60 : closeMinutes

      if (currentMinutesSinceMidnight >= openMinutes && currentMinutesSinceMidnight < actualCloseMinutes) {
        return { isOpen: true, canDetermine: true }
      }
      
      // If venueHours says closed (outside hours), but we have openingHoursJson, double-check
      // openingHoursJson from Google is more authoritative and may have more recent data
      if (openingHoursJson) {
        const jsonCheck = isVenueOpenNow(openingHoursJson, timezone, null)
        // If openingHoursJson says open, trust it over venueHours (Google data is more authoritative)
        if (jsonCheck.isOpen && jsonCheck.canDetermine) {
          return { isOpen: true, canDetermine: true }
        }
      }
      
      return { isOpen: false, canDetermine: true }
    }
    // If no hours for today in venueHours, fall back to openingHoursJson if available
    // Don't assume closed if we have openingHoursJson to check
    if (openingHoursJson) {
      // Fall through to openingHoursJson logic below
    } else {
      // No hours for today and no openingHoursJson, assume closed
      return { isOpen: false, canDetermine: true }
    }
  }

  // Fallback to openingHoursJson
  if (!openingHoursJson) {
    return { isOpen: false, canDetermine: false }
  }

  const hours = openingHoursJson as GoogleOpeningHours

  // Prefer periods over weekdayDescriptions - periods are more reliable for determining "now" status
  // Use periods to determine if open now (if available)
  if (hours.periods && Array.isArray(hours.periods) && hours.periods.length > 0) {
    for (const period of hours.periods) {
      if (!period.open) continue

      const openDay = period.open.day
      const openMinutes = period.open.hour * 60 + period.open.minute

      // Check if period starts today
      if (openDay === currentDay) {
        if (!period.close) {
          // Open 24 hours
          return { isOpen: true, canDetermine: true }
        }

        const closeDay = period.close.day
        const closeMinutes = period.close.hour * 60 + period.close.minute

        if (closeDay === currentDay) {
          // Same day period
          if (currentMinutesSinceMidnight >= openMinutes && currentMinutesSinceMidnight < closeMinutes) {
            return { isOpen: true, canDetermine: true }
          }
        } else {
          // Overnight period - if it opened today, we're open until midnight
          if (currentMinutesSinceMidnight >= openMinutes) {
            return { isOpen: true, canDetermine: true }
          }
        }
      }

      // Check if period started yesterday and closes today (overnight spillover)
      const yesterday = (currentDay + 6) % 7
      if (openDay === yesterday && period.close && period.close.day === currentDay) {
        const closeMinutes = period.close.hour * 60 + period.close.minute
        if (currentMinutesSinceMidnight < closeMinutes) {
          return { isOpen: true, canDetermine: true }
        }
      }
    }
    
    // If we checked periods and didn't find a match, venue is closed
    return { isOpen: false, canDetermine: true }
  }

  // If we have weekdayDescriptions but no periods, we can't easily determine "now" status
  // (would need to parse the strings, which is error-prone)
  if (hours.weekdayDescriptions && hours.weekdayDescriptions.length > 0) {
    return { isOpen: false, canDetermine: false }
  }

  return { isOpen: false, canDetermine: true }
}

/**
 * Get today's hours as a formatted string
 */
export function getTodaysHours(openingHoursJson: any): string | null {
  if (!openingHoursJson) return null

  const hours = openingHoursJson as GoogleOpeningHours
  const today = new Date().getDay()

  // Prefer weekdayDescriptions, but verify it's actually for today
  if (hours.weekdayDescriptions && Array.isArray(hours.weekdayDescriptions) && hours.weekdayDescriptions.length > today) {
    const todayDescription = hours.weekdayDescriptions[today]
    if (todayDescription) {
      // Verify the day name in the description matches today
      // weekdayDescriptions format: "Mon: 7:00 AM – 4:00 PM" or "Monday: 7:00 AM – 4:00 PM"
      const todayAbbrev = DAY_ABBREVIATIONS[today]
      const todayFull = DAY_NAMES[today]
      // Check if the description starts with today's day name (case-insensitive)
      const descriptionUpper = todayDescription.toUpperCase()
      const todayAbbrevUpper = todayAbbrev.toUpperCase()
      const todayFullUpper = todayFull.toUpperCase()
      if (descriptionUpper.startsWith(todayAbbrevUpper) || descriptionUpper.startsWith(todayFullUpper)) {
        return todayDescription
      }
      // If day name doesn't match, fall through to periods parsing
    }
  }

  // Parse from periods
  if (hours.periods && Array.isArray(hours.periods)) {
    const todayIntervals: Array<{ open: string; close: string | null }> = []

    for (const period of hours.periods) {
      if (!period.open) continue

      const openDay = period.open.day
      const openTime = formatTime(period.open.hour, period.open.minute)

      if (openDay === today) {
        if (!period.close) {
          todayIntervals.push({ open: openTime, close: null })
        } else {
          const closeDay = period.close.day
          const closeTime = formatTime(period.close.hour, period.close.minute)

          if (closeDay === today) {
            todayIntervals.push({ open: openTime, close: closeTime })
          } else {
            // Overnight - show until midnight
            todayIntervals.push({ open: openTime, close: "11:59 PM" })
          }
        }
      }

      // Check overnight spillover (started yesterday, closes today)
      const yesterday = (today + 6) % 7
      if (openDay === yesterday && period.close && period.close.day === today) {
        const closeTime = formatTime(period.close.hour, period.close.minute)
        todayIntervals.push({ open: "12:00 AM", close: closeTime })
      }
    }

    if (todayIntervals.length === 0) {
      const dayName = DAY_ABBREVIATIONS[today]
      return `${dayName}: Closed`
    }

    const intervalStrs = todayIntervals.map((interval) => {
      if (interval.close === null) {
        return `${interval.open} – 11:59 PM`
      }
      return `${interval.open} – ${interval.close}`
    })

    // Add day name prefix to match weekdayDescriptions format
    const dayName = DAY_ABBREVIATIONS[today]
    return `${dayName}: ${intervalStrs.join(", ")}`
  }

  return null
}

/**
 * Format full weekly schedule for display
 */
export function formatHoursForDisplay(openingHoursJson: any): string[] {
  const { formatted } = parseGoogleHours(openingHoursJson)
  return formatted
}

/**
 * Convert time (hour, minute) to "HH:MM" format
 */
function formatTimeHHMM(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
}

/**
 * Parse Google periods array to normalized VenueHours data
 * Returns array of 7 objects (one per day of week, 0=Sunday, 6=Saturday)
 */
export function parseGooglePeriodsToVenueHours(
  periods: Array<{
    open: {
      day: number
      hour: number
      minute: number
    }
    close?: {
      day: number
      hour: number
      minute: number
    }
  }>,
  venueId: string,
  source: string = "google"
): Array<{
  venueId: string
  dayOfWeek: number
  isClosed: boolean
  openTime: string | null
  closeTime: string | null
  source: string
}> {
  // Initialize all days as closed
  const days: Array<{
    venueId: string
    dayOfWeek: number
    isClosed: boolean
    openTime: string | null
    closeTime: string | null
    source: string
  }> = []

  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    days.push({
      venueId,
      dayOfWeek,
      isClosed: true,
      openTime: null,
      closeTime: null,
      source,
    })
  }

  if (!periods || !Array.isArray(periods) || periods.length === 0) {
    return days
  }

  // Process each period
  for (const period of periods) {
    if (!period.open) continue

    const openDay = period.open.day
    const openTime = formatTimeHHMM(period.open.hour, period.open.minute)

    if (!period.close) {
      // Open 24 hours - mark as open from midnight to 23:59
      if (days[openDay].isClosed) {
        days[openDay] = {
          venueId,
          dayOfWeek: openDay,
          isClosed: false,
          openTime: "00:00",
          closeTime: "23:59",
          source,
        }
      } else {
        // Already has hours - extend if needed
        if (!days[openDay].openTime || days[openDay].openTime! > openTime) {
          days[openDay].openTime = "00:00"
        }
        days[openDay].closeTime = "23:59"
      }
      continue
    }

    const closeDay = period.close.day
    const closeTime = formatTimeHHMM(period.close.hour, period.close.minute)

    if (openDay === closeDay) {
      // Same day period
      if (days[openDay].isClosed) {
        days[openDay] = {
          venueId,
          dayOfWeek: openDay,
          isClosed: false,
          openTime,
          closeTime,
          source,
        }
      } else {
        // Already has hours - this is a second period for the same day
        // For simplicity, we'll take the earliest open and latest close
        // (This handles cases like "9:00 AM - 12:00 PM, 1:00 PM - 5:00 PM")
        if (!days[openDay].openTime || days[openDay].openTime! > openTime) {
          days[openDay].openTime = openTime
        }
        if (!days[openDay].closeTime || days[openDay].closeTime! < closeTime) {
          days[openDay].closeTime = closeTime
        }
      }
    } else {
      // Overnight period (e.g., Friday 10 PM - Saturday 2 AM)
      // Mark opening day as open until 23:59
      if (days[openDay].isClosed) {
        days[openDay] = {
          venueId,
          dayOfWeek: openDay,
          isClosed: false,
          openTime,
          closeTime: "23:59",
          source,
        }
      } else {
        if (!days[openDay].openTime || days[openDay].openTime! > openTime) {
          days[openDay].openTime = openTime
        }
        days[openDay].closeTime = "23:59"
      }

      // Mark closing day as open from 00:00
      if (days[closeDay].isClosed) {
        days[closeDay] = {
          venueId,
          dayOfWeek: closeDay,
          isClosed: false,
          openTime: "00:00",
          closeTime,
          source,
        }
      } else {
        days[closeDay].openTime = "00:00"
        if (!days[closeDay].closeTime || days[closeDay].closeTime! < closeTime) {
          days[closeDay].closeTime = closeTime
        }
      }
    }
  }

  return days
}

/**
 * Upsert VenueHours records for a venue
 */
export async function upsertVenueHours(
  prisma: any,
  venueId: string,
  hoursData: Array<{
    venueId: string
    dayOfWeek: number
    isClosed: boolean
    openTime: string | null
    closeTime: string | null
    source: string
  }>
): Promise<void> {
  // Upsert each day
  for (const dayData of hoursData) {
    await prisma.venueHours.upsert({
      where: {
        venueId_dayOfWeek: {
          venueId: dayData.venueId,
          dayOfWeek: dayData.dayOfWeek,
        },
      },
      update: {
        isClosed: dayData.isClosed,
        openTime: dayData.openTime,
        closeTime: dayData.closeTime,
        source: dayData.source,
      },
      create: dayData,
    })
  }
}

/**
 * Convert "HH:MM" string to minutes since midnight
 */
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number)
  return hours * 60 + minutes
}

/**
 * Convert VenueHours records to interval format (for compatibility with existing slot logic)
 * Returns array of {startMin, endMin} intervals for the given date
 */
export function getOpenIntervalsFromVenueHours(
  venueHours: Array<{
    dayOfWeek: number
    isClosed: boolean
    openTime: string | null
    closeTime: string | null
  }>,
  dateStr: string
): Array<{ startMin: number; endMin: number }> {
  const dayStart = new Date(`${dateStr}T00:00:00`)
  const weekday = dayStart.getDay() // 0=Sunday, ..., 6=Saturday

  const dayHours = venueHours.find((h) => h.dayOfWeek === weekday)
  if (!dayHours || dayHours.isClosed || !dayHours.openTime || !dayHours.closeTime) {
    return []
  }

  const startMin = timeToMinutes(dayHours.openTime)
  const endMin = timeToMinutes(dayHours.closeTime)

  // Handle case where closeTime is "23:59" (should be treated as end of day)
  const actualEndMin = dayHours.closeTime === "23:59" ? 24 * 60 : endMin

  return [{ startMin, endMin: actualEndMin }]
}

/**
 * Check if a reservation time window is within venue hours
 * Returns { isValid: boolean, error?: string }
 */
export function isReservationWithinHours(
  startAt: Date,
  endAt: Date,
  venueHours: Array<{
    dayOfWeek: number
    isClosed: boolean
    openTime: string | null
    closeTime: string | null
  }> | null,
  openingHoursJson: any
): { isValid: boolean; error?: string } {
  // Disallow multi-day reservations (per requirements)
  const startDate = startAt.toISOString().split("T")[0]
  const endDate = endAt.toISOString().split("T")[0]
  if (startDate !== endDate) {
    return {
      isValid: false,
      error: "Reservations cannot span multiple days. Please select a time within a single day.",
    }
  }

  // Prefer VenueHours if available
  if (venueHours && venueHours.length > 0) {
    const intervals = getOpenIntervalsFromVenueHours(venueHours, startDate)
    if (intervals.length === 0) {
      return {
        isValid: false,
        error: "This venue is closed on the selected day. Please check opening hours.",
      }
    }

    const startMin = startAt.getHours() * 60 + startAt.getMinutes()
    const endMin = endAt.getHours() * 60 + endAt.getMinutes()

    // Check if reservation fits within any open interval
    const fits = intervals.some((interval) => startMin >= interval.startMin && endMin <= interval.endMin)

    if (!fits) {
      return {
        isValid: false,
        error: "This venue is not open during the requested time. Please check opening hours.",
      }
    }

    return { isValid: true }
  }

  // Fallback to openingHoursJson parsing (backward compatibility)
  if (openingHoursJson) {
    const dateStr = startAt.toISOString().split("T")[0]
    const dayStart = new Date(`${dateStr}T00:00:00`)
    const weekday = dayStart.getDay()

    const hours = openingHoursJson as GoogleOpeningHours
    if (hours.periods && Array.isArray(hours.periods)) {
      const startMin = startAt.getHours() * 60 + startAt.getMinutes()
      const endMin = endAt.getHours() * 60 + endAt.getMinutes()

      let hasValidPeriod = false
      for (const period of hours.periods) {
        if (!period.open) continue

        const openDay = period.open.day
        const openMin = period.open.hour * 60 + period.open.minute

        if (openDay === weekday) {
          if (!period.close) {
            // Open 24 hours
            hasValidPeriod = true
            if (startMin >= openMin && endMin <= 24 * 60) {
              return { isValid: true }
            }
          } else {
            const closeDay = period.close.day
            const closeMin = period.close.hour * 60 + period.close.minute

            if (closeDay === weekday) {
              // Same day
              hasValidPeriod = true
              if (startMin >= openMin && endMin <= closeMin) {
                return { isValid: true }
              }
            } else {
              // Overnight - open until midnight
              hasValidPeriod = true
              if (startMin >= openMin && endMin <= 24 * 60) {
                return { isValid: true }
              }
            }
          }
        }

        // Check overnight spillover (started yesterday, closes today)
        const yesterday = (weekday + 6) % 7
        if (openDay === yesterday && period.close && period.close.day === weekday) {
          const closeMin = period.close.hour * 60 + period.close.minute
          hasValidPeriod = true
          if (startMin >= 0 && endMin <= closeMin) {
            return { isValid: true }
          }
        }
      }

      if (hasValidPeriod) {
        return {
          isValid: false,
          error: "This venue is not open during the requested time. Please check opening hours.",
        }
      }
    }
  }

  // No hours data - allow booking (fallback behavior)
  return { isValid: true }
}

/**
 * Find the next time a venue opens
 * Returns a Date object for when the venue opens next, or null if it's open now or can't determine
 */
export function getNextOpenTime(
  venueHours?: Array<{
    dayOfWeek: number
    isClosed: boolean
    openTime: string | null
    closeTime: string | null
  }> | null,
  openingHoursJson?: any
): Date | null {
  const now = new Date()
  const currentDay = now.getDay() // 0=Sunday, ..., 6=Saturday
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  const currentMinutesSinceMidnight = currentHour * 60 + currentMinute

  // Prefer venueHours if available
  if (venueHours && venueHours.length > 0) {
    // First check if venue is open now - if so, return null (shouldn't call this function)
    const todayHours = venueHours.find((h) => h.dayOfWeek === currentDay)
    if (todayHours && !todayHours.isClosed && todayHours.openTime && todayHours.closeTime) {
      const openMinutes = timeToMinutes(todayHours.openTime)
      const closeMinutes = timeToMinutes(todayHours.closeTime)
      const actualCloseMinutes = todayHours.closeTime === "23:59" ? 24 * 60 : closeMinutes
      
      // If currently open, return null (this function shouldn't be called when open)
      if (currentMinutesSinceMidnight >= openMinutes && currentMinutesSinceMidnight < actualCloseMinutes) {
        return null
      }
      
      // Check if opens later today
      if (currentMinutesSinceMidnight < openMinutes) {
        // Opens later today
        const nextOpen = new Date(now)
        nextOpen.setHours(Math.floor(openMinutes / 60), openMinutes % 60, 0, 0)
        return nextOpen
      }
    }

    // Check next 7 days for next open time
    for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
      const checkDay = (currentDay + dayOffset) % 7
      const dayHours = venueHours.find((h) => h.dayOfWeek === checkDay)
      if (dayHours && !dayHours.isClosed && dayHours.openTime) {
        const openMinutes = timeToMinutes(dayHours.openTime)
        const nextOpen = new Date(now)
        nextOpen.setDate(nextOpen.getDate() + dayOffset)
        nextOpen.setHours(Math.floor(openMinutes / 60), openMinutes % 60, 0, 0)
        return nextOpen
      }
    }

    // If we checked all days and none are open, return null (venue might be permanently closed)
    return null
  }

  // Fallback to openingHoursJson
  if (!openingHoursJson) {
    return null
  }

  const hours = openingHoursJson as GoogleOpeningHours
  if (!hours.periods || !Array.isArray(hours.periods)) {
    return null
  }

  // First check if venue is open now - if so, return null (shouldn't call this function)
  for (const period of hours.periods) {
    if (!period.open) continue

    const openDay = period.open.day
    const openMinutes = period.open.hour * 60 + period.open.minute

    // Check if period starts today
    if (openDay === currentDay) {
      if (!period.close) {
        // Open 24 hours - venue is open now
        return null
      }

      const closeDay = period.close.day
      const closeMinutes = period.close.hour * 60 + period.close.minute

      if (closeDay === currentDay) {
        // Same day period - check if currently open
        if (currentMinutesSinceMidnight >= openMinutes && currentMinutesSinceMidnight < closeMinutes) {
          return null // Venue is open now
        }
      } else {
        // Overnight period - if it opened today, we're open until midnight
        if (currentMinutesSinceMidnight >= openMinutes) {
          return null // Venue is open now
        }
      }
    }

    // Check overnight spillover (started yesterday, closes today)
    const yesterday = (currentDay + 6) % 7
    if (openDay === yesterday && period.close && period.close.day === currentDay) {
      const closeMinutes = period.close.hour * 60 + period.close.minute
      if (currentMinutesSinceMidnight < closeMinutes) {
        return null // Venue is open now
      }
    }
  }

  // Check if opens later today
  for (const period of hours.periods) {
    if (!period.open) continue

    const openDay = period.open.day
    const openMinutes = period.open.hour * 60 + period.open.minute

    if (openDay === currentDay && currentMinutesSinceMidnight < openMinutes) {
      // Opens later today
      const nextOpen = new Date(now)
      nextOpen.setHours(period.open.hour, period.open.minute, 0, 0)
      return nextOpen
    }
  }

  // Check next 7 days
  for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
    const checkDay = (currentDay + dayOffset) % 7
    for (const period of hours.periods) {
      if (!period.open) continue
      if (period.open.day === checkDay) {
        const nextOpen = new Date(now)
        nextOpen.setDate(nextOpen.getDate() + dayOffset)
        nextOpen.setHours(period.open.hour, period.open.minute, 0, 0)
        return nextOpen
      }
    }
  }

  return null
}

/**
 * Format day name for display (e.g., "Monday", "Tomorrow")
 */
function formatDayName(date: Date, today: Date): string {
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  if (date.toDateString() === today.toDateString()) {
    return "today"
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return "tomorrow"
  }
  
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  return dayNames[date.getDay()]
}
