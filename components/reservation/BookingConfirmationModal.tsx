"use client"

import React, { useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2, Clock, MapPin, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type ReservationForConfirmation = {
  id: string
  startAt: string // ISO
  endAt: string // ISO
  seatCount: number
  venue: {
    name: string
    address: string | null
    hourlySeatPrice: number // Fallback for backward compatibility
    averageSeatPrice?: number // Seat-level pricing (preferred)
    rulesText: string | null
  }
  seat?: {
    id: string
    label: string | null
    pricePerHour: number
    table?: {
      directionsText: string | null
    } | null
  } | null
  table?: {
    directionsText: string | null
  } | null
}

function formatDateTimeRange(startAtISO: string, endAtISO: string) {
  const start = new Date(startAtISO)
  const end = new Date(endAtISO)

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })

  return {
    date: dateFormatter.format(start),
    timeRange: `${timeFormatter.format(start)} – ${timeFormatter.format(end)}`,
  }
}

function hoursBetween(startAtISO: string, endAtISO: string): number {
  const start = new Date(startAtISO).getTime()
  const end = new Date(endAtISO).getTime()
  return Math.max(0, (end - start) / (1000 * 60 * 60))
}

function toGoogleCalendarDateUTC(iso: string): string {
  // Google expects: YYYYMMDDTHHMMSSZ
  const d = new Date(iso)
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(d.getUTCDate()).padStart(2, "0")
  const hh = String(d.getUTCHours()).padStart(2, "0")
  const min = String(d.getUTCMinutes()).padStart(2, "0")
  const ss = String(d.getUTCSeconds()).padStart(2, "0")
  return `${yyyy}${mm}${dd}T${hh}${min}${ss}Z`
}

function toICSDateUTC(iso: string): string {
  // YYYYMMDDTHHmmssZ
  return toGoogleCalendarDateUTC(iso)
}

function escapeICSString(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
}

function buildICS(res: ReservationForConfirmation): string {
  const uid = `nooc-reservation-${res.id}@nooc.app`
  const dtstamp = toICSDateUTC(new Date().toISOString())
  const dtstart = toICSDateUTC(res.startAt)
  const dtend = toICSDateUTC(res.endAt)

  const summary = escapeICSString(`Nooc: Reservation @ ${res.venue.name}`)
  const location = res.venue.address ? escapeICSString(res.venue.address) : ""
  const seatText = `${res.seatCount} seat${res.seatCount > 1 ? "s" : ""}`

  const rules = res.venue.rulesText
    ? `\\n\\nHouse rules:\\n${escapeICSString(res.venue.rulesText)}`
    : ""
  const description = escapeICSString(`Reserved ${seatText} via Nooc.`) + rules

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nooc//Reservation//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${summary}`,
    `LOCATION:${location}`,
    `DESCRIPTION:${description}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")
}

export function BookingConfirmationModal({
  open,
  onOpenChange,
  reservation,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  reservation: ReservationForConfirmation | null
}) {
  const router = useRouter()
  
  // Helper function to derive directions from reservation
  const getDirectionsText = (res: ReservationForConfirmation | null): string | null => {
    if (!res) return null
    // If reservation has seatId, look up the seat's table and use Table.directionsText
    if (res.seat?.table?.directionsText) {
      return res.seat.table.directionsText
    }
    // Else if reservation has tableId, use Table.directionsText
    if (res.table?.directionsText) {
      return res.table.directionsText
    }
    // Else return null
    return null
  }

  const computed = useMemo(() => {
    if (!reservation) return null

    const { date, timeRange } = formatDateTimeRange(reservation.startAt, reservation.endAt)
    const hours = hoursBetween(reservation.startAt, reservation.endAt)
    // Use seat.pricePerHour if available, otherwise fallback to averageSeatPrice or hourlySeatPrice
    const pricePerSeatPerHour =
      reservation.seat?.pricePerHour ??
      reservation.venue.averageSeatPrice ??
      reservation.venue.hourlySeatPrice
    const estimated = pricePerSeatPerHour * hours * reservation.seatCount

    const googleUrl = (() => {
      const text = `Nooc: Reservation @ ${reservation.venue.name}`
      const dates = `${toGoogleCalendarDateUTC(reservation.startAt)}/${toGoogleCalendarDateUTC(
        reservation.endAt
      )}`
      const detailsParts = [
        `Reserved ${reservation.seatCount} seat${reservation.seatCount > 1 ? "s" : ""} via Nooc.`,
        reservation.venue.rulesText ? `\n\nHouse rules:\n${reservation.venue.rulesText}` : "",
      ].filter(Boolean)
      const details = detailsParts.join("")
      const location = reservation.venue.address || ""

      const params = new URLSearchParams({
        action: "TEMPLATE",
        text,
        dates,
        details,
        location,
      })
      return `https://calendar.google.com/calendar/render?${params.toString()}`
    })()

    const ics = buildICS(reservation)
    const icsDataUrl = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`

    const directionsText = getDirectionsText(reservation)

    return { date, timeRange, estimated, googleUrl, icsDataUrl, directionsText }
  }, [reservation])

  return (
    <Dialog open={open} onOpenChange={(isOpen) => onOpenChange(isOpen)}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="mb-2 flex justify-center">
            <div className="rounded-full bg-emerald-50 p-3">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">You’re all set.</DialogTitle>
        </DialogHeader>

        {!reservation || !computed ? (
          <p className="text-sm text-muted-foreground">Loading your confirmation…</p>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-5">
                <div className="space-y-4">
                  <div>
                    <h2 className="text-base font-semibold">{reservation.venue.name}</h2>
                    {reservation.venue.address && (
                      <div className="mt-1 flex items-start gap-2 text-sm text-muted-foreground">
                        <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <span>{reservation.venue.address}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 border-t pt-3">
                    <div className="flex items-start gap-2 text-sm">
                      <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{computed.date}</p>
                        <p className="text-muted-foreground">{computed.timeRange}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">
                          {reservation.seatCount} seat{reservation.seatCount > 1 ? "s" : ""}
                        </p>
                        {reservation.seat?.label && (
                          <p className="text-xs text-muted-foreground">
                            {reservation.seat.label}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {computed.directionsText && (
                    <div className="border-t pt-3">
                      <p className="text-sm font-medium">Directions to your seat</p>
                      <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                        {computed.directionsText}
                      </p>
                    </div>
                  )}

                  <div className="border-t pt-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm text-muted-foreground">Estimated</span>
                      <span className="text-lg font-semibold">${computed.estimated.toFixed(2)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      No payment collected in MVP. This is an estimate only.
                    </p>
                  </div>

                  {reservation.venue.rulesText && (
                    <div className="border-t pt-3">
                      <p className="text-sm font-medium">House rules</p>
                      <p className="mt-1 line-clamp-4 whitespace-pre-line text-sm text-muted-foreground">
                        {reservation.venue.rulesText}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-2">
              <Button asChild size="lg">
                <Link 
                  href="/reservations" 
                  onClick={() => {
                    onOpenChange(false)
                    // Refresh the reservations page to show the new reservation
                    router.refresh()
                  }}
                >
                  View my reservations
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/" onClick={() => onOpenChange(false)}>
                  Back to Explore
                </Link>
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button asChild variant="outline">
                  <a href={computed.googleUrl} target="_blank" rel="noreferrer">
                    Google Calendar
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={computed.icsDataUrl} download={`nooc-reservation-${reservation.id}.ics`}>
                    Apple Calendar
                  </a>
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

