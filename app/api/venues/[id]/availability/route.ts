import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

type OpeningHoursPeriod = {
  open: { day: number; hour: number; minute: number }
  close?: { day: number; hour: number; minute: number }
}

function minutesSinceMidnight(hour: number, minute: number) {
  return hour * 60 + minute
}

// Returns booking intervals (in minutes since midnight) for the given local date.
// If Google hours exist, we map them; otherwise we fall back to 8:00–20:00.
function getOpenIntervalsForDate(
  dateStr: string,
  openingHoursJson: any
): Array<{ startMin: number; endMin: number }> {
  // Fallback window (MVP)
  const fallback = [{ startMin: 8 * 60, endMin: 20 * 60 }]

  const periods: OpeningHoursPeriod[] | undefined =
    openingHoursJson?.periods && Array.isArray(openingHoursJson.periods)
      ? openingHoursJson.periods
      : undefined

  if (!periods || periods.length === 0) return fallback

  const dayStart = new Date(`${dateStr}T00:00:00`)
  const weekday = dayStart.getDay() // 0=Sun ... 6=Sat

  const intervals: Array<{ startMin: number; endMin: number }> = []

  for (const p of periods) {
    if (!p?.open) continue
    const openDay = p.open.day
    const openMin = minutesSinceMidnight(p.open.hour, p.open.minute)
    const closeDay = p.close?.day
    const closeMin =
      p.close ? minutesSinceMidnight(p.close.hour, p.close.minute) : null

    // If the period starts today
    if (openDay === weekday) {
      // If no close, treat as open until end of day
      if (closeMin === null || closeDay === undefined) {
        intervals.push({ startMin: openMin, endMin: 24 * 60 })
        continue
      }

      // Close same day
      if (closeDay === weekday) {
        if (closeMin > openMin) {
          intervals.push({ startMin: openMin, endMin: closeMin })
        }
        continue
      }

      // Close next day (overnight): open until midnight for this day
      intervals.push({ startMin: openMin, endMin: 24 * 60 })
      continue
    }

    // If the period started yesterday and closes today (overnight spillover)
    const yesterday = (weekday + 6) % 7
    if (openDay === yesterday && closeDay === weekday && closeMin !== null) {
      intervals.push({ startMin: 0, endMin: closeMin })
    }
  }

  // If we couldn't map anything, fall back
  if (intervals.length === 0) return fallback

  // Normalize/clip and sort
  const normalized = intervals
    .map((i) => ({
      startMin: Math.max(0, Math.min(24 * 60, i.startMin)),
      endMin: Math.max(0, Math.min(24 * 60, i.endMin)),
    }))
    .filter((i) => i.endMin > i.startMin)
    .sort((a, b) => a.startMin - b.startMin)

  return normalized.length ? normalized : fallback
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  const venueId = params.id

  const { searchParams } = new URL(request.url)
  const date = searchParams.get("date")

  if (!date) {
    return NextResponse.json(
      { error: "Missing date parameter (YYYY-MM-DD)." },
      { status: 400 }
    )
  }

  try {
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      include: {
        tables: true,
        reservations: {
          where: {
            status: {
              not: "cancelled",
            },
          },
        },
      },
    })

    if (!venue) {
      return NextResponse.json({ error: "Venue not found." }, { status: 404 })
    }

    const capacity = venue.tables.reduce((sum, table) => sum + table.seatCount, 0)

    if (capacity <= 0) {
      return NextResponse.json(
        { error: "This venue has no reservable seats configured yet." },
        { status: 400 }
      )
    }

    // Build the day range in local time (MVP approximation)
    const dayStart = new Date(`${date}T00:00:00`)
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

    // Filter reservations that intersect this day
    const reservations = venue.reservations.filter(
      (r) => r.startAt < dayEnd && r.endAt > dayStart
    )

    // Define booking windows for slots from Google opening hours (fallback to 8:00–20:00)
    const slots = []
    const openIntervals = getOpenIntervalsForDate(date, (venue as any).openingHoursJson)

    for (const interval of openIntervals) {
      for (let m = interval.startMin; m < interval.endMin; m += 15) {
        const slotStart = new Date(dayStart)
        slotStart.setMinutes(m, 0, 0)

        const slotEnd = new Date(slotStart.getTime() + 15 * 60 * 1000)

        // Skip slots that start outside interval (e.g., last slot spills past close)
        if (slotEnd.getTime() > dayStart.getTime() + interval.endMin * 60 * 1000) {
          continue
        }

        // Overlap: existing.startAt < slotEnd AND existing.endAt > slotStart
        const bookedSeats = reservations.reduce((sum, r) => {
          if (r.startAt < slotEnd && r.endAt > slotStart) {
            return sum + r.seatCount
          }
          return sum
        }, 0)

        const availableSeats = Math.max(capacity - bookedSeats, 0)

        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          availableSeats,
          isFullyBooked: availableSeats <= 0,
        })
      }
    }

    return NextResponse.json(
      {
        capacity,
        slots,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching availability:", error)
    return NextResponse.json(
      { error: "Failed to fetch availability." },
      { status: 500 }
    )
  }
}

