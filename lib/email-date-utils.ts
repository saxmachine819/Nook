/**
 * Timezone-aware date/time formatting for emails.
 * Uses venue timezone so times display correctly regardless of server TZ (e.g. Vercel UTC).
 * Default timezone matches lib/hours DEFAULT_TIMEZONE.
 */

export const DEFAULT_TIMEZONE = "America/New_York"

/**
 * Format a Date in a given IANA timezone as local date and time for URL params.
 * Used by reminder emails so the venue page pre-fills the correct venue-local time.
 * Returns date as YYYY-MM-DD and time as HHmm (no colon).
 */
export function formatDateAndTimeInZone(
  date: Date,
  timeZone?: string
): { date: string; timeHHmm: string } {
  const tz = timeZone?.trim() || DEFAULT_TIMEZONE
  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  const timeFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  const dateStr = dateFormatter.format(date) // "YYYY-MM-DD" with en-CA
  const timeStr = timeFormatter.format(date) // "HH:mm"
  const timeHHmm = timeStr.replace(":", "")
  return { date: dateStr, timeHHmm }
}

/**
 * Format an ISO date-time string for display in a given timezone.
 * Example: "2025-02-05T19:30:00.000Z" in America/New_York → "2/5/2025, 2:30 PM"
 */
export function formatDateTimeInTimezone(iso: string, timeZone?: string): string {
  try {
    const date = new Date(iso)
    if (isNaN(date.getTime())) return iso
    const tz = timeZone?.trim() || DEFAULT_TIMEZONE
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date)
  } catch {
    return iso
  }
}

/**
 * Format an ISO date-time string as a bare clock time in a given timezone.
 * Example: "2025-02-05T19:30:00.000Z" in America/New_York -> "2:30 PM"
 *
 * Unlike the formatters above this returns null for missing or unparseable
 * input rather than echoing the raw string, because callers use it to build
 * subject lines and push titles: a null lets them fall back to time-agnostic
 * copy instead of mailing someone an ISO timestamp.
 */
export function formatTimeInTimezone(iso?: string, timeZone?: string): string | null {
  if (!iso) return null
  try {
    const date = new Date(iso)
    if (isNaN(date.getTime())) return null
    const tz = timeZone?.trim() || DEFAULT_TIMEZONE
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
    }).format(date)
  } catch {
    return null
  }
}

/**
 * Format a start and end ISO string as a time range in a given timezone.
 * Example: "2:30 PM – 4:30 PM"
 */
export function formatTimeRangeInTimezone(
  startAt: string,
  endAt: string,
  timeZone?: string
): string {
  try {
    const start = new Date(startAt)
    const end = new Date(endAt)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return `${startAt} – ${endAt}`
    const tz = timeZone?.trim() || DEFAULT_TIMEZONE
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
    })
    return `${formatter.format(start)} – ${formatter.format(end)}`
  } catch {
    return `${startAt} – ${endAt}`
  }
}
