import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { enqueueNotification } from "@/lib/notification-queue"
import { formatDateAndTimeInZone, DEFAULT_TIMEZONE } from "@/lib/email-date-utils"

// LOCAL-ONLY: set e.g. CUSTOMER_FOLLOW_UP_HOUR=14, CUSTOMER_FOLLOW_UP_MINUTE_START=0, CUSTOMER_FOLLOW_UP_MINUTE_END=59 to test in the 2pm hour
function getFollowUpWindow(): { hour: number; minuteStart: number; minuteEnd: number } {
  const hourStr = process.env.CUSTOMER_FOLLOW_UP_HOUR
  const startStr = process.env.CUSTOMER_FOLLOW_UP_MINUTE_START
  const endStr = process.env.CUSTOMER_FOLLOW_UP_MINUTE_END
  const hour = hourStr != null ? parseInt(hourStr, 10) : 18
  const minuteStart = startStr != null ? parseInt(startStr, 10) : 0
  const minuteEnd = endStr != null ? parseInt(endStr, 10) : 30
  return {
    hour: isNaN(hour) ? 18 : hour,
    minuteStart: isNaN(minuteStart) ? 0 : minuteStart,
    minuteEnd: isNaN(minuteEnd) ? 30 : minuteEnd,
  }
}

function getHourAndMinuteInTimezone(date: Date, timeZone: string): { hour: number; minute: number } {
  const tz = timeZone?.trim() || DEFAULT_TIMEZONE
  const { timeHHmm } = formatDateAndTimeInZone(date, tz)
  const hour = parseInt(timeHHmm.slice(0, 2), 10)
  const minute = parseInt(timeHHmm.slice(2, 4), 10)
  return { hour: isNaN(hour) ? 0 : hour, minute: isNaN(minute) ? 0 : minute }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("Authorization")?.trim() ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : ""
  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { hour: targetHour, minuteStart, minuteEnd } = getFollowUpWindow()
  const now = new Date()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? ""

  const venues = await prisma.venue.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, timezone: true },
  })

  let enqueued = 0
  let skipped = 0

  for (const venue of venues) {
    const tz = venue.timezone?.trim() || DEFAULT_TIMEZONE
    const { hour, minute } = getHourAndMinuteInTimezone(now, tz)
    if (hour !== targetHour || minute < minuteStart || minute > minuteEnd) {
      continue
    }

    const todayInTz = formatDateAndTimeInZone(now, tz).date

    const reservations = await prisma.reservation.findMany({
      where: { venueId: venue.id, status: "active" },
      include: {
        user: { select: { email: true } },
      },
    })

    for (const reservation of reservations) {
      const startAtDateInTz = formatDateAndTimeInZone(reservation.startAt, tz).date
      if (startAtDateInTz !== todayInTz) continue

      const email = reservation.user?.email?.trim()
      if (!email) {
        skipped++
        continue
      }

      try {
        const rebookUrl = baseUrl ? `${baseUrl}/venue/${venue.id}` : ""
        await enqueueNotification({
          type: "customer_follow_up",
          dedupeKey: `customer_follow_up:${reservation.id}`,
          toEmail: email,
          userId: reservation.userId ?? undefined,
          venueId: venue.id,
          bookingId: reservation.id,
          payload: {
            bookingId: reservation.id,
            venueId: venue.id,
            venueName: venue.name ?? "",
            rebookUrl,
          },
        })
        enqueued++
      } catch (err) {
        console.error("Failed to enqueue customer_follow_up for reservation", reservation.id, err)
        skipped++
      }
    }
  }

  return NextResponse.json({ enqueued, skipped })
}
