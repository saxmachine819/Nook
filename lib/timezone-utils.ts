import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import customParseFormat from "dayjs/plugin/customParseFormat";

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

/**
 * Standard timezone for the application if none is provided.
 */
export const DEFAULT_TIMEZONE = "America/New_York";

/**
 * Get a dayjs object for a given date in a specific timezone.
 *
 * @param date - The date to convert (Date object, timestamp, or string).
 * @param tz - The IANA timezone string (e.g., "America/New_York").
 * @returns A dayjs object localized to the timezone.
 */
export function getInTimezone(
  date: Date | string | number,
  tz: string = DEFAULT_TIMEZONE,
): dayjs.Dayjs {
  try {
    return dayjs(date).tz(tz);
  } catch (e) {
    console.error(
      `Invalid timezone "${tz}", falling back to ${DEFAULT_TIMEZONE}`,
    );
    return dayjs(date).tz(DEFAULT_TIMEZONE);
  }
}

/**
 * Convert a date (or dayjs object) to a vanilla JS Date object in UTC.
 *
 * @param date - The date/dayjs object to convert.
 * @returns A standard JS Date object.
 */
export function convertToUtc(date: Date | string | number | dayjs.Dayjs): Date {
  return dayjs(date).utc().toDate();
}

/**
 * Format a date in a specific timezone.
 *
 * @param date - The date to format.
 * @param tz - The timezone to use.
 * @param formatStr - The dayjs format string (e.g., "h:mm A").
 * @returns The formatted date string.
 */
export function formatInTimezone(
  date: Date | string | number,
  tz: string = DEFAULT_TIMEZONE,
  formatStr: string = "YYYY-MM-DD HH:mm:ss",
): string {
  return getInTimezone(date, tz).format(formatStr);
}

/**
 * Get the day of the week (0-6, 0=Sunday) for a date in a specific timezone.
 *
 * @param date - The date to check.
 * @param tz - The timezone to use.
 * @returns The weekday index (0-6).
 */
export function getDayOfWeek(
  date: Date | string | number,
  tz: string = DEFAULT_TIMEZONE,
): number {
  return getInTimezone(date, tz).day();
}

/**
 * Check if a given "HH:mm" time string is within an open/close range.
 * Handle wrap-around hours if necessary (though usually venue hours are within one day).
 *
 * @param timeStr - The time to check in "HH:mm" format (e.g., "14:30").
 * @param openStr - The open time in "HH:mm" format.
 * @param closeStr - The close time in "HH:mm" format.
 * @returns True if the time is within the range [open, close).
 */
export function isTimeWithinRange(
  timeStr: string,
  openStr: string,
  closeStr: string,
): boolean {
  const time = parseHHMM(timeStr);
  const open = parseHHMM(openStr);
  let close = parseHHMM(closeStr);

  if (time === null || open === null || close === null) return false;

  // Handle "23:59" as midnight (24:00) for easier calculations
  if (closeStr === "23:59") close = 24 * 60;

  return time >= open && time < close;
}

/**
 * Parse "HH:mm" string into minutes since midnight.
 *
 * @param hhmm - Time string (e.g., "09:30").
 * @returns Minutes since midnight (e.g., 570) or null if invalid.
 */
export function parseHHMM(hhmm: string | null | undefined): number | null {
  if (!hhmm || typeof hhmm !== "string") return null;
  const parts = hhmm.split(":");
  if (parts.length !== 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * Format minutes since midnight into a display string (e.g., "9:30 AM").
 *
 * @param minutes - Minutes since midnight.
 * @returns Formatted time string.
 */
export function formatMinutesToDisplay(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/**
 * Get the start and end Dates for a given calendar day in a specific timezone.
 *
 * @param dateStr - The date string (YYYY-MM-DD).
 * @param tz - The timezone.
 * @returns An object with start and end Date objects for that day.
 */
export function getDayBoundsInTimezone(
  dateStr: string,
  tz: string = DEFAULT_TIMEZONE,
): { start: Date; end: Date } {
  const start = dayjs.tz(dateStr, tz).startOf("day");
  const end = start.endOf("day");
  return {
    start: start.toDate(),
    end: end.toDate(),
  };
}

/**
 * Get parts of a date (year, month, day, hour, minute, weekday) in a specific timezone.
 */
export function getPartsInTimezone(
  date: Date | string | number,
  tz: string = DEFAULT_TIMEZONE,
) {
  const d = getInTimezone(date, tz);
  return {
    year: d.year(),
    month: d.month() + 1, // 1-12
    day: d.date(),
    hour: d.hour(),
    minute: d.minute(),
    dayOfWeek: d.day(), // 0-6
    todayLabel: d.format("ddd"),
  };
}

/**
 * Create a Date object for a specific hour/minute on a given reference date's calendar day in a timezone.
 * Handles DST transitions: if the requested time doesn't exist (Spring Forward), advances to the next valid time.
 */
export function dateAtTimeInTimezone(
  tz: string,
  ref: Date,
  hour: number,
  minute: number,
): Date {
  const refDayjs = dayjs.tz(ref, tz);
  const dateStr = refDayjs.format("YYYY-MM-DD");
  const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  
  // Parse date+time string directly - dayjs will automatically handle DST transitions
  // If time doesn't exist (Spring Forward gap), it advances to the next valid time
  return dayjs.tz(`${dateStr} ${timeStr}`, "YYYY-MM-DD HH:mm", tz)
    .second(0)
    .millisecond(0)
    .toDate();
}

/**
 * Round up a date to the next 15-minute boundary.
 */
export function roundUpToNext15Minutes(date: Date): Date {
  const d = dayjs(date);
  const minutes = d.minute();
  const remainder = minutes % 15;

  if (remainder === 0 && d.second() === 0 && d.millisecond() === 0) {
    return date;
  }

  return d
    .add(15 - remainder, "minute")
    .startOf("minute")
    .second(0)
    .millisecond(0)
    .toDate();
}
