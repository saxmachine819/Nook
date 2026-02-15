"use client"

import React, { useMemo } from "react"
import type { OpenStatus, WeeklyHoursRow } from "@/lib/hours"

const DAY_ABBREV = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function parseHHMM(time: string): number | null {
  const parts = time.split(":")
  if (parts.length !== 2) return null
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  if (isNaN(h) || isNaN(m)) return null
  return h * 60 + m
}

function formatMinutesToDisplay(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  const period = h >= 12 ? "PM" : "AM"
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${displayH}:${m.toString().padStart(2, "0")} ${period}`
}

/**
 * Convert a venue-local time on a given day-of-week to the equivalent time in another timezone.
 *
 * Approach:
 * 1. Interpret "HH:MM" as UTC on an anchored reference date, then use Intl.DateTimeFormat
 *    to read the rendered hour/day in the venue timezone. The difference tells us the
 *    venue-to-UTC offset so we can find the true UTC moment for "HH:MM in venue TZ".
 * 2. Format that true UTC moment in the target timezone.
 */
function convertTimeAcrossTimezones(
  time: string,
  dayOfWeek: number,
  fromTimezone: string,
  toTimezone: string
): { time: string; dayOfWeek: number } | null {
  const [hour, minute] = time.split(":").map(Number)
  if (isNaN(hour) || isNaN(minute)) return null

  // Anchor: 2025-02-02 is a Sunday (dayOfWeek 0)
  const refDayOfMonth = 2 + dayOfWeek
  const fakeUtc = new Date(Date.UTC(2025, 1, refDayOfMonth, hour, minute))

  const getPartsVal = (
    formatter: Intl.DateTimeFormat,
    date: Date,
    type: string
  ): number =>
    parseInt(
      formatter.formatToParts(date).find((p) => p.type === type)?.value ?? "0",
      10
    )

  const fromFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: fromTimezone,
    hour: "numeric",
    minute: "numeric",
    day: "2-digit",
    hour12: false,
  })

  // Determine venue-to-UTC offset by comparing what the venue TZ renders vs raw UTC
  const fromDay = getPartsVal(fromFormatter, fakeUtc, "day")
  const fromH = getPartsVal(fromFormatter, fakeUtc, "hour") % 24
  const fromM = getPartsVal(fromFormatter, fakeUtc, "minute")
  const dayDiffFrom = fromDay - refDayOfMonth
  const fromOffsetMinutes =
    dayDiffFrom * 24 * 60 + fromH * 60 + fromM - (hour * 60 + minute)

  // True UTC = fakeUtc shifted by -fromOffset
  const trueUtc = new Date(fakeUtc.getTime() - fromOffsetMinutes * 60_000)

  // Read the result in the target timezone
  const toFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: toTimezone,
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  })
  const toParts = toFormatter.formatToParts(trueUtc)
  const toH =
    parseInt(toParts.find((p) => p.type === "hour")?.value ?? "0", 10) % 24
  const toM = parseInt(
    toParts.find((p) => p.type === "minute")?.value ?? "0",
    10
  )
  const toWeekday = toParts.find((p) => p.type === "weekday")?.value ?? ""

  const weekdayToNumber: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  }

  return {
    time: `${toH}:${toM.toString().padStart(2, "0")}`,
    dayOfWeek: weekdayToNumber[toWeekday] ?? dayOfWeek,
  }
}

function formatWeeklyHoursInUserTimezone(
  weeklyHours: WeeklyHoursRow[],
  venueTimezone: string,
  userTimezone: string
): string[] {
  const rows = weeklyHours.slice().sort((a, b) => a.dayOfWeek - b.dayOfWeek)

  // Build a map of converted times per user-local day
  const dayMap = new Map<number, { open: number; close: number }>()

  for (const row of rows) {
    if (row.isClosed || !row.openTime || !row.closeTime) continue

    const convertedOpen = convertTimeAcrossTimezones(
      row.openTime, row.dayOfWeek, venueTimezone, userTimezone
    )
    const convertedClose = convertTimeAcrossTimezones(
      row.closeTime, row.dayOfWeek, venueTimezone, userTimezone
    )

    if (!convertedOpen || !convertedClose) continue

    const openMin = parseHHMM(convertedOpen.time)
    const closeMin = parseHHMM(convertedClose.time)
    if (openMin == null || closeMin == null) continue

    // Use the open time's day as the anchor
    const userDay = convertedOpen.dayOfWeek
    const existing = dayMap.get(userDay)
    if (!existing) {
      dayMap.set(userDay, {
        open: openMin,
        close: convertedClose.time === "23:59" ? 24 * 60 : closeMin,
      })
    } else {
      // Merge: use earliest open and latest close
      dayMap.set(userDay, {
        open: Math.min(existing.open, openMin),
        close: Math.max(existing.close, convertedClose.time === "23:59" ? 24 * 60 : closeMin),
      })
    }
  }

  const out: string[] = []
  for (let d = 0; d < 7; d++) {
    const label = DAY_ABBREV[d]
    const entry = dayMap.get(d)
    if (!entry) {
      out.push(`${label}: Closed`)
    } else {
      out.push(
        `${label}: ${formatMinutesToDisplay(entry.open)} – ${formatMinutesToDisplay(entry.close)}`
      )
    }
  }
  return out
}

function getTimezoneLabel(timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    })
    const parts = formatter.formatToParts(new Date())
    return parts.find((p) => p.type === "timeZoneName")?.value ?? timezone
  } catch {
    return timezone
  }
}

interface VenueHoursDisplayProps {
  openStatus: OpenStatus | null
  weeklyFormatted: string[]
  venueTimezone?: string | null
  weeklyHours?: WeeklyHoursRow[]
}

export function VenueHoursDisplay({
  openStatus,
  weeklyFormatted,
  venueTimezone,
  weeklyHours,
}: VenueHoursDisplayProps) {
  const hasHours = weeklyFormatted.length > 0
  const isOpen = openStatus?.isOpen ?? false
  const canDetermine = openStatus != null
  const todaysHours = openStatus?.todayHoursText ?? null

  const userTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
      return null
    }
  }, [])

  const showUserTimezone =
    !!venueTimezone &&
    !!userTimezone &&
    !!weeklyHours &&
    weeklyHours.length > 0 &&
    venueTimezone !== userTimezone

  const userWeeklyFormatted = useMemo(() => {
    if (!showUserTimezone || !weeklyHours || !venueTimezone || !userTimezone) return []
    return formatWeeklyHoursInUserTimezone(weeklyHours, venueTimezone, userTimezone)
  }, [showUserTimezone, weeklyHours, venueTimezone, userTimezone])

  const userTimezoneLabel = useMemo(() => {
    if (!userTimezone) return ""
    return getTimezoneLabel(userTimezone)
  }, [userTimezone])

  if (!hasHours && !openStatus) {
    return null
  }

  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground">Hours</div>
        {canDetermine && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              isOpen
                ? "bg-emerald-50 text-emerald-700"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {isOpen ? "Open now" : "Closed now"}
          </span>
        )}
      </div>
      {todaysHours && (
        <p className="mb-2 text-sm font-medium">{todaysHours}</p>
      )}
      {weeklyFormatted.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            View weekly hours
          </summary>
          <div className="mt-2 space-y-1">
            {weeklyFormatted.map((dayHours, index) => (
              <div key={index} className="text-xs text-muted-foreground">
                {dayHours}
              </div>
            ))}
          </div>
        </details>
      )}
      {showUserTimezone && userWeeklyFormatted.length > 0 && (
        <details className="group mt-2">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            Hours in your timezone ({userTimezoneLabel})
          </summary>
          <div className="mt-2 space-y-1">
            {userWeeklyFormatted.map((dayHours, index) => (
              <div key={index} className="text-xs text-muted-foreground">
                {dayHours}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
