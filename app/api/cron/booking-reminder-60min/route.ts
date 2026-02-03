import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { enqueueNotification } from "@/lib/notification-queue"

// LOCAL-ONLY: set BOOKING_REMINDER_60MIN_WINDOW_START=1 and BOOKING_REMINDER_60MIN_WINDOW_END=3 for near-term testing
function getWindowMinutes(): { start: number; end: number } {
  const startStr = process.env.BOOKING_REMINDER_60MIN_WINDOW_START
  const endStr = process.env.BOOKING_REMINDER_60MIN_WINDOW_END
  const start = startStr != null ? parseInt(startStr, 10) : 54
  const end = endStr != null ? parseInt(endStr, 10) : 66
  return { start: isNaN(start) ? 54 : start, end: isNaN(end) ? 66 : end }
}

function buildViewBookingUrl(reservation: {
  venueId: string
  seatId: string | null
  tableId: string | null
  startAt: Date
  endAt: Date
}): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? ""
  const params = new URLSearchParams()
  if (reservation.seatId) {
    params.set("resourceType", "seat")
    params.set("resourceId", reservation.seatId)
  } else if (reservation.tableId) {
    params.set("resourceType", "table")
    params.set("resourceId", reservation.tableId)
  }
  const startAt = new Date(reservation.startAt)
  const endAt = new Date(reservation.endAt)
  const date = `${startAt.getFullYear()}-${String(startAt.getMonth() + 1).padStart(2, "0")}-${String(startAt.getDate()).padStart(2, "0")}`
  const startTime = `${String(startAt.getHours()).padStart(2, "0")}${String(startAt.getMinutes()).padStart(2, "0")}`
  const duration = Math.max(1, Math.round((endAt.getTime() - startAt.getTime()) / (60 * 60 * 1000)))
  const booking = JSON.stringify({ date, startTime, duration })
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
      startAt: { gte: windowStart, lte: windowEnd },
    },
    include: {
      user: { select: { email: true } },
      venue: { select: { name: true } },
      seat: { select: { label: true, name: true } },
      table: { select: { name: true } },
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
      const seatLabel = reservation.seat?.label?.trim() || reservation.seat?.name?.trim() || null
      const tableLabel = reservation.table?.name?.trim() || null
      const viewBookingUrl = buildViewBookingUrl({
        venueId: reservation.venueId,
        seatId: reservation.seatId,
        tableId: reservation.tableId,
        startAt: reservation.startAt,
        endAt: reservation.endAt,
      })
      await enqueueNotification({
        type: "booking_reminder_60min",
        dedupeKey: `booking_reminder_60min:${reservation.id}`,
        toEmail: email,
        userId: reservation.userId ?? undefined,
        venueId: reservation.venueId,
        bookingId: reservation.id,
        payload: {
          bookingId: reservation.id,
          venueId: reservation.venueId,
          venueName: reservation.venue?.name ?? "",
          seatId: reservation.seatId ?? null,
          tableId: reservation.tableId ?? null,
          seatLabel,
          tableLabel,
          startAt: reservation.startAt.toISOString(),
          endAt: reservation.endAt.toISOString(),
          viewBookingUrl,
        },
      })
      enqueued++
    } catch (err) {
      console.error("Failed to enqueue booking_reminder_60min for reservation", reservation.id, err)
      skipped++
    }
  }

  return NextResponse.json({ enqueued, skipped })
}
