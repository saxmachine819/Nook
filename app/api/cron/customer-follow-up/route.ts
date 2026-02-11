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
    console.error("[customer-follow-up] Unauthorized: missing or invalid CRON_SECRET")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { hour: targetHour, minuteStart, minuteEnd } = getFollowUpWindow()
  const now = new Date()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? ""

  console.log(`[customer-follow-up] Cron triggered at ${now.toISOString()}, target window: ${targetHour}:${minuteStart.toString().padStart(2, "0")}-${targetHour}:${minuteEnd.toString().padStart(2, "0")}`)

  const venues = await prisma.venue.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, timezone: true },
  })

  console.log(`[customer-follow-up] Found ${venues.length} active venues`)

  let enqueued = 0
  let skipped = 0
  const skipReasons: Record<string, number> = {}

  for (const venue of venues) {
    const tz = venue.timezone?.trim() || DEFAULT_TIMEZONE
    const { hour, minute } = getHourAndMinuteInTimezone(now, tz)
    
    // Fixed: use inclusive boundaries (minute >= minuteStart && minute <= minuteEnd)
    if (hour !== targetHour || minute < minuteStart || minute > minuteEnd) {
      const reason = hour !== targetHour 
        ? `hour mismatch (${hour} !== ${targetHour})` 
        : `minute out of range (${minute} not in [${minuteStart}, ${minuteEnd}])`
      skipReasons[reason] = (skipReasons[reason] || 0) + 1
      continue
    }

    const todayInTz = formatDateAndTimeInZone(now, tz).date
    console.log(`[customer-follow-up] Processing venue ${venue.id} (${venue.name}) at ${hour}:${minute.toString().padStart(2, "0")} in ${tz}, today: ${todayInTz}`)

    const reservations = await prisma.reservation.findMany({
      where: { venueId: venue.id, status: "active" },
      include: {
        user: { select: { email: true } },
      },
    })

    console.log(`[customer-follow-up] Found ${reservations.length} active reservations for venue ${venue.id}`)

    for (const reservation of reservations) {
      const startAtDateInTz = formatDateAndTimeInZone(reservation.startAt, tz).date
      if (startAtDateInTz !== todayInTz) {
        skipped++
        skipReasons[`reservation not today (start: ${startAtDateInTz}, today: ${todayInTz})`] = (skipReasons[`reservation not today (start: ${startAtDateInTz}, today: ${todayInTz})`] || 0) + 1
        continue
      }

      const email = reservation.user?.email?.trim()
      if (!email) {
        skipped++
        skipReasons["no user email"] = (skipReasons["no user email"] || 0) + 1
        continue
      }

      try {
        const rebookUrl = baseUrl ? `${baseUrl}/venue/${venue.id}` : ""
        const result = await enqueueNotification({
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
        if (result.created) {
          console.log(`[customer-follow-up] Enqueued notification for reservation ${reservation.id} (${email})`)
          enqueued++
        } else {
          console.log(`[customer-follow-up] Notification already exists for reservation ${reservation.id} (dedupe)`)
          skipped++
          skipReasons["duplicate dedupeKey"] = (skipReasons["duplicate dedupeKey"] || 0) + 1
        }
      } catch (err) {
        console.error(`[customer-follow-up] Failed to enqueue customer_follow_up for reservation ${reservation.id}:`, err)
        skipped++
        skipReasons["enqueue error"] = (skipReasons["enqueue error"] || 0) + 1
      }
    }
  }

  const summary = {
    enqueued,
    skipped,
    skipReasons,
    venuesProcessed: venues.length,
    timestamp: now.toISOString(),
  }

  console.log(`[customer-follow-up] Completed:`, JSON.stringify(summary, null, 2))

  return NextResponse.json(summary)
}
