/**
 * Shared hours engine: canonical venue hours (load + precedence) and open status at a timestamp.
 * All "today" and open-window logic use venue timezone; default America/New_York when missing.
 * See docs/HOURS_AUDIT.md and plan: shared hours engine.
 */

import { prisma } from "@/lib/prisma"
import { getEffectiveVenueHours } from "@/lib/venue-hours"

const DEFAULT_TIMEZONE = "America/New_York"
const WEEKDAY_ABBREV: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

export type WeeklyHoursRow = {
  dayOfWeek: number
  isClosed: boolean
  openTime: string | null
  closeTime: string | null
}

export type CanonicalVenueHours = {
  timezone: string
  weeklyHours: WeeklyHoursRow[]
}

export type OpenStatusStatus = "OPEN_NOW" | "CLOSED_NOW" | "OPENS_LATER" | "CLOSED_TODAY"

export type OpenStatus = {
  isOpen: boolean
  status: OpenStatusStatus
  todayLabel: string
  todayHoursText: string
  nextOpenAt?: Date
  diagnosticMessage?: string
}

/**
 * Load canonical venue hours: venue timezone + effective weekly hours (respects manual vs google precedence).
 */
export async function getCanonicalVenueHours(venueId: string): Promise<CanonicalVenueHours | null> {
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: {
      timezone: true,
      hoursSource: true,
      venueHours: {
        orderBy: { dayOfWeek: "asc" },
        select: { dayOfWeek: true, isClosed: true, openTime: true, closeTime: true, source: true },
      },
    },
  })
  if (!venue) return null
  const effective = getEffectiveVenueHours(venue.venueHours, venue.hoursSource)
  const weeklyHours = [...effective].sort((a, b) => a.dayOfWeek - b.dayOfWeek)
  return {
    timezone: venue.timezone ?? DEFAULT_TIMEZONE,
    weeklyHours,
  }
}

/**
 * Get date/time parts for a moment in a timezone (weekday 0-6, hour, minute, etc.).
 */
function getPartsInTimezone(at: Date, tz: string): {
  dayOfWeek: number
  hour: number
  minute: number
  year: number
  month: number
  day: number
  todayLabel: string
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  })
  const parts = formatter.formatToParts(at)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  const weekday = get("weekday")
  const dayOfWeek = WEEKDAY_ABBREV[weekday] ?? 0
  const hour = parseInt(get("hour"), 10) || 0
  const minute = parseInt(get("minute"), 10) || 0
  const year = parseInt(get("year"), 10) || 0
  const month = parseInt(get("month"), 10) || 0
  const day = parseInt(get("day"), 10) || 0
  return {
    dayOfWeek,
    hour,
    minute,
    year,
    month,
    day,
    todayLabel: weekday,
  }
}

/**
 * Return UTC Date for "refDate's calendar day in tz at hour:minute (in tz)".
 * Uses iteration to find UTC ms that formats to the desired local time in tz.
 */
function dateAtTimeInTimezone(
  tz: string,
  refDate: Date,
  hour: number,
  minute: number
): Date {
  const { year, month, day } = getPartsInTimezone(refDate, tz)
  // Candidate UTC range: same calendar day in UTC can be ~-12h to +12h from local noon
  const localNoon = Date.UTC(year, month - 1, day, hour, minute)
  const rangeMs = 24 * 60 * 60 * 1000
  let best = localNoon
  let bestDiff = Infinity
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  })
  const target = { year, month, day, hour, minute }
  for (let offset = -rangeMs; offset <= rangeMs; offset += 60 * 1000) {
    const candidate = new Date(localNoon + offset)
    const parts = formatter.formatToParts(candidate)
    const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10)
    const y = get("year")
    const m = get("month")
    const d = get("day")
    const h = get("hour")
    const min = get("minute")
    const diff =
      Math.abs(y - target.year) +
      Math.abs(m - target.month) +
      Math.abs(d - target.day) +
      Math.abs(h - target.hour) +
      Math.abs(min - target.minute)
    if (diff < bestDiff) {
      bestDiff = diff
      best = candidate.getTime()
    }
    if (diff === 0) return new Date(best)
  }
  return new Date(best)
}

/**
 * Parse HH:MM to minutes since midnight. Returns null if invalid.
 */
function parseHHMM(s: string | null): number | null {
  if (!s || typeof s !== "string") return null
  const match = /^(\d{1,2}):(\d{2})$/.exec(s.trim())
  if (!match) return null
  const h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  const min = h * 60 + m
  return min <= 24 * 60 ? min : null
}

/**
 * Format minutes since midnight as "9:00 AM" style.
 */
function formatMinutesToDisplay(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const period = h >= 12 ? "PM" : "AM"
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${displayH}:${m.toString().padStart(2, "0")} ${period}`
}

/**
 * Find next open moment after refDate (in venue TZ): first future day with open hours, at openTime in TZ.
 */
function findNextOpen(
  weeklyHours: WeeklyHoursRow[],
  tz: string,
  refDate: Date,
  afterDayOfWeek: number
): Date | undefined {
  for (let offset = 1; offset <= 7; offset++) {
    const dayOfWeek = (afterDayOfWeek + offset) % 7
    const row = weeklyHours.find((h) => h.dayOfWeek === dayOfWeek)
    if (!row || row.isClosed) continue
    const openMin = parseHHMM(row.openTime)
    if (openMin == null) continue
    const openH = Math.floor(openMin / 60)
    const openM = openMin % 60
    const nextDate = new Date(refDate.getTime() + offset * 24 * 60 * 60 * 1000)
    const parts = getPartsInTimezone(nextDate, tz)
    if (parts.dayOfWeek !== dayOfWeek) continue
    const candidate = dateAtTimeInTimezone(tz, nextDate, openH, openM)
    if (candidate.getTime() > refDate.getTime()) return candidate
  }
  return undefined
}

/**
 * Compute open status at a given moment: is open, status enum, today label, today hours text, next open time.
 * All logic uses venue timezone; invalid/missing open or close yields closed + diagnosticMessage for admin.
 */
export function getOpenStatus(canonical: CanonicalVenueHours, at: Date): OpenStatus {
  const tz = canonical.timezone || DEFAULT_TIMEZONE
  const { dayOfWeek: atDayOfWeek, hour, minute, todayLabel } = getPartsInTimezone(at, tz)
  const atMinutesSinceMidnight = hour * 60 + minute

  const todayRow = canonical.weeklyHours.find((h) => h.dayOfWeek === atDayOfWeek)

  const closedResult = (
    status: OpenStatusStatus,
    nextOpenAt?: Date,
    diagnosticMessage?: string
  ): OpenStatus => ({
    isOpen: false,
    status,
    todayLabel,
    todayHoursText: "Closed",
    ...(nextOpenAt != null && { nextOpenAt }),
    ...(diagnosticMessage != null && { diagnosticMessage }),
  })

  if (!todayRow || todayRow.isClosed) {
    const nextOpenAt = findNextOpen(canonical.weeklyHours, tz, at, atDayOfWeek)
    return closedResult("CLOSED_TODAY", nextOpenAt)
  }

  const openMin = parseHHMM(todayRow.openTime)
  const closeMinRaw = parseHHMM(todayRow.closeTime)
  if (openMin == null || closeMinRaw == null) {
    const diagnosticMessage = `Invalid or missing open/close for ${todayLabel}`
    const nextOpenAt = findNextOpen(canonical.weeklyHours, tz, at, atDayOfWeek)
    return closedResult("CLOSED_TODAY", nextOpenAt, diagnosticMessage)
  }

  const closeMin = todayRow.closeTime === "23:59" ? 24 * 60 : closeMinRaw
  if (closeMin <= openMin) {
    const diagnosticMessage = `Invalid open/close for ${todayLabel} (close before or equal to open)`
    const nextOpenAt = findNextOpen(canonical.weeklyHours, tz, at, atDayOfWeek)
    return closedResult("CLOSED_TODAY", nextOpenAt, diagnosticMessage)
  }

  const todayHoursText = `${formatMinutesToDisplay(openMin)} – ${formatMinutesToDisplay(closeMin)}`

  if (atMinutesSinceMidnight >= openMin && atMinutesSinceMidnight < closeMin) {
    return {
      isOpen: true,
      status: "OPEN_NOW",
      todayLabel,
      todayHoursText,
    }
  }

  if (atMinutesSinceMidnight < openMin) {
    const openH = Math.floor(openMin / 60)
    const openM = openMin % 60
    const nextOpenAt = dateAtTimeInTimezone(tz, at, openH, openM)
    return {
      isOpen: false,
      status: "OPENS_LATER",
      todayLabel,
      todayHoursText,
      nextOpenAt,
    }
  }

  const nextOpenAt = findNextOpen(canonical.weeklyHours, tz, at, atDayOfWeek)
  return closedResult("CLOSED_NOW", nextOpenAt)
}

/**
 * Get weekday (0–6) for a calendar date string YYYY-MM-DD in the given timezone.
 */
function getWeekdayForDateStr(dateStr: string, tz: string): number {
  const ref = new Date(dateStr + "T12:00:00.000Z")
  return getPartsInTimezone(ref, tz).dayOfWeek
}

/**
 * Open intervals (minutes since midnight) for a calendar day in venue timezone.
 * Used to limit time slots to within the venue's open window.
 */
export function getOpenIntervalsForDate(
  canonical: CanonicalVenueHours,
  dateStr: string
): Array<{ startMin: number; endMin: number }> {
  const tz = canonical.timezone || DEFAULT_TIMEZONE
  const dayOfWeek = getWeekdayForDateStr(dateStr, tz)
  const row = canonical.weeklyHours.find((h) => h.dayOfWeek === dayOfWeek)
  if (!row || row.isClosed) return []
  const openMin = parseHHMM(row.openTime)
  const closeMinRaw = parseHHMM(row.closeTime)
  if (openMin == null || closeMinRaw == null) return []
  const endMin = row.closeTime === "23:59" ? 24 * 60 : closeMinRaw
  if (endMin <= openMin) return []
  return [{ startMin: openMin, endMin }]
}

/**
 * 15-minute slot boundaries (UTC) for a calendar day within venue open hours.
 */
export function getSlotTimesForDate(
  canonical: CanonicalVenueHours,
  dateStr: string
): Array<{ start: Date; end: Date }> {
  const tz = canonical.timezone || DEFAULT_TIMEZONE
  const intervals = getOpenIntervalsForDate(canonical, dateStr)
  if (intervals.length === 0) return []
  const refDate = new Date(dateStr + "T12:00:00.000Z")
  const slots: Array<{ start: Date; end: Date }> = []
  for (const { startMin, endMin } of intervals) {
    for (let m = startMin; m < endMin; m += 15) {
      const endM = m + 15
      if (endM > endMin) break
      const start = dateAtTimeInTimezone(tz, refDate, Math.floor(m / 60), m % 60)
      const end = dateAtTimeInTimezone(tz, refDate, Math.floor(endM / 60), endM % 60)
      slots.push({ start, end })
    }
  }
  return slots
}

/**
 * Validate that a reservation window falls within venue open hours (venue timezone, single day).
 * Use for server-side booking validation; message distinguishes "not open at this time" from other errors.
 */
export function isReservationWithinCanonicalHours(
  startAt: Date,
  endAt: Date,
  canonical: CanonicalVenueHours
): { isValid: boolean; error?: string } {
  const tz = canonical.timezone || DEFAULT_TIMEZONE
  const startParts = getPartsInTimezone(startAt, tz)
  const endParts = getPartsInTimezone(endAt, tz)
  const startDateStr = `${startParts.year}-${String(startParts.month).padStart(2, "0")}-${String(startParts.day).padStart(2, "0")}`
  const endDateStr = `${endParts.year}-${String(endParts.month).padStart(2, "0")}-${String(endParts.day).padStart(2, "0")}`
  if (startDateStr !== endDateStr) {
    return {
      isValid: false,
      error: "Reservations cannot span multiple days. Please select a time within a single day.",
    }
  }
  const intervals = getOpenIntervalsForDate(canonical, startDateStr)
  if (intervals.length === 0) {
    return {
      isValid: false,
      error: "This venue isn't open at this time. Please check opening hours.",
    }
  }
  const startMin = startParts.hour * 60 + startParts.minute
  const endMin = endParts.hour * 60 + endParts.minute
  const fits = intervals.some((i) => startMin >= i.startMin && endMin <= i.endMin)
  if (!fits) {
    return {
      isValid: false,
      error: "This venue isn't open at this time. Please check opening hours.",
    }
  }
  return { isValid: true }
}

const DAY_ABBREV = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/**
 * Format canonical weekly hours for display (e.g. "Mon: 9:00 AM – 5:00 PM" or "Mon: Closed").
 */
export function formatWeeklyHoursFromCanonical(canonical: CanonicalVenueHours): string[] {
  const rows = canonical.weeklyHours.slice().sort((a, b) => a.dayOfWeek - b.dayOfWeek)
  const out: string[] = []
  for (let d = 0; d < 7; d++) {
    const row = rows.find((r) => r.dayOfWeek === d)
    const label = DAY_ABBREV[d] ?? "?"
    if (!row || row.isClosed || row.openTime == null || row.closeTime == null) {
      out.push(`${label}: Closed`)
      continue
    }
    const openMin = parseHHMM(row.openTime)
    const closeMinRaw = parseHHMM(row.closeTime)
    if (openMin == null || closeMinRaw == null) {
      out.push(`${label}: Closed`)
      continue
    }
    const closeMin = row.closeTime === "23:59" ? 24 * 60 : closeMinRaw
    out.push(
      `${label}: ${formatMinutesToDisplay(openMin)} – ${formatMinutesToDisplay(closeMin)}`
    )
  }
  return out
}
