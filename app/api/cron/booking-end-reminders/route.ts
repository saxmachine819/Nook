import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { enqueueNotification } from "@/lib/notification-queue"
import { formatDateAndTimeInZone, DEFAULT_TIMEZONE } from "@/lib/email-date-utils"

function getWindowMinutes(): { start: number; end: number } {
  const startStr = process.env.BOOKING_REMINDER_WINDOW_START_MINUTES
  const endStr = process.env.BOOKING_REMINDER_WINDOW_END_MINUTES
  const start = startStr != null ? parseInt(startStr, 10) : 4
  const end = endStr != null ? parseInt(endStr, 10) : 6
  return { start: isNaN(start) ? 4 : start, end: isNaN(end) ? 6 : end }
}

function buildExtendUrl(
  reservation: {
    venueId: string
    seatId: string | null
    tableId: string | null
    endAt: Date
  },
  timeZone?: string
): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? ""
  const params = new URLSearchParams()
  if (reservation.seatId) {
    params.set("resourceType", "seat")
    params.set("resourceId", reservation.seatId)
  } else if (reservation.tableId) {
    params.set("resourceType", "table")
    params.set("resourceId", reservation.tableId)
  }
  const endAt = new Date(reservation.endAt)
  const tz = timeZone?.trim() || DEFAULT_TIMEZONE
  const { date, timeHHmm } = formatDateAndTimeInZone(endAt, tz)
  const booking = JSON.stringify({ date, startTime: timeHHmm, duration: 1 })
  params.set("booking", booking)
  return `${baseUrl}/venue/${reservation.venueId}?${params.toString()}`
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("Authorization")?.trim() ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : ""
  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { start: startMin, end: endMin } = getWindowMinutes()
  const now = new Date()
  const windowStart = new Date(now.getTime() + startMin * 60 * 1000)
  const windowEnd = new Date(now.getTime() + endMin * 60 * 1000)

  const reservations = await prisma.reservation.findMany({
    where: {
      status: "active",
      endAt: { gte: windowStart, lte: windowEnd },
    },
    include: {
      user: { select: { email: true } },
      venue: { select: { name: true, timezone: true } },
    },
  })

  let enqueued = 0
  let skipped = 0

  for (const reservation of reservations) {
    const email = reservation.user?.email?.trim()
    if (!email) {
      skipped++
      continue
    }
    try {
      const resourceType = reservation.seatId ? "seat" : "table"
      const resourceId = reservation.seatId ?? reservation.tableId ?? ""
      const extendUrl = buildExtendUrl(
        {
          venueId: reservation.venueId,
          seatId: reservation.seatId,
          tableId: reservation.tableId,
          endAt: reservation.endAt,
        },
        reservation.venue?.timezone ?? undefined
      )
      await enqueueNotification({
        type: "booking_end_5min",
        dedupeKey: `booking_end_5min:${reservation.id}`,
        toEmail: email,
        userId: reservation.userId ?? undefined,
        venueId: reservation.venueId,
        bookingId: reservation.id,
        payload: {
          bookingId: reservation.id,
          venueId: reservation.venueId,
          venueName: reservation.venue?.name ?? "",
          timeZone: reservation.venue?.timezone ?? undefined,
          seatId: reservation.seatId ?? null,
          tableId: reservation.tableId ?? null,
          resourceType,
          resourceId,
          extendUrl,
          suggestedExtensionStartAt: reservation.endAt.toISOString(),
          suggestedExtensionEndAt: new Date(reservation.endAt.getTime() + 60 * 60 * 1000).toISOString(),
        },
      })
      enqueued++
    } catch (err) {
      console.error("Failed to enqueue booking_end_5min for reservation", reservation.id, err)
      skipped++
    }
  }

  return NextResponse.json({ enqueued, skipped })
}
