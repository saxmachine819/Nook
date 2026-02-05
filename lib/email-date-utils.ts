/**
 * Timezone-aware date/time formatting for emails.
 * Uses venue timezone so times display correctly regardless of server TZ (e.g. Vercel UTC).
 * Default timezone matches lib/hours DEFAULT_TIMEZONE.
 */

const DEFAULT_TIMEZONE = "America/New_York"

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
