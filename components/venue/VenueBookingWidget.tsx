"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { BookingConfirmationModal } from "@/components/reservation/BookingConfirmationModal"

interface VenueBookingWidgetProps {
  venueId: string
  hourlySeatPrice: number
  maxCapacity: number
}

export function VenueBookingWidget({
  venueId,
  hourlySeatPrice,
  maxCapacity,
}: VenueBookingWidgetProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast, ToastComponent } = useToast()
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const [confirmedReservation, setConfirmedReservation] = useState<any>(null)

  const [date, setDate] = useState<string>("")
  const [startTime, setStartTime] = useState<string>("")
  const [durationHours, setDurationHours] = useState<number>(2)
  const [seats, setSeats] = useState<number>(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Restore booking data from URL params if present (after sign-in)
  useEffect(() => {
    const bookingParam = searchParams.get("booking")
    if (bookingParam) {
      try {
        const bookingData = JSON.parse(decodeURIComponent(bookingParam))
        if (bookingData.date) setDate(bookingData.date)
        if (bookingData.startTime) {
          // Convert "HHMM" format to "HH:MM"
          const timeStr = String(bookingData.startTime).padStart(4, "0")
          if (timeStr.length === 4) {
            setStartTime(`${timeStr.slice(0, 2)}:${timeStr.slice(2)}`)
          }
        }
        if (bookingData.duration !== undefined) {
          // Duration is in hours (converted from VenueCard slots or from VenueBookingWidget)
          setDurationHours(bookingData.duration)
        }
        if (bookingData.seats) setSeats(bookingData.seats)
        
        // Remove booking param from URL
        const newUrl = new URL(window.location.href)
        newUrl.searchParams.delete("booking")
        router.replace(newUrl.pathname + newUrl.search, { scroll: false })
        
        // Auto-submit after a brief delay to ensure form is ready
        setTimeout(() => {
          const form = document.querySelector('form')
          if (form) {
            form.requestSubmit()
          }
        }, 200)
      } catch (e) {
        console.error("Failed to parse booking data:", e)
      }
      return
    }

    // Default initialization if no booking data
    const now = new Date()
    const rounded = new Date(now)
    if (rounded.getMinutes() > 0 || rounded.getSeconds() > 0 || rounded.getMilliseconds() > 0) {
      rounded.setHours(rounded.getHours() + 1, 0, 0, 0)
    } else {
      rounded.setMinutes(0, 0, 0)
    }

    const yyyy = rounded.getFullYear()
    const mm = String(rounded.getMonth() + 1).padStart(2, "0")
    const dd = String(rounded.getDate()).padStart(2, "0")
    const hh = String(rounded.getHours()).padStart(2, "0")
    const min = String(rounded.getMinutes()).padStart(2, "0")

    setDate(`${yyyy}-${mm}-${dd}`)
    setStartTime(`${hh}:${min}`)
  }, [searchParams, router])

  const totalPrice = useMemo(() => {
    if (!hourlySeatPrice || !durationHours || !seats) return 0
    return hourlySeatPrice * durationHours * seats
  }, [hourlySeatPrice, durationHours, seats])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!date || !startTime) {
      setError("Please select a date and start time.")
      return
    }

    if (seats < 1 || seats > 8) {
      setError("You can reserve between 1 and 8 seats.")
      return
    }

    if (durationHours < 1 || durationHours > 8) {
      setError("Duration must be between 1 and 8 hours.")
      return
    }

    if (seats > maxCapacity) {
      setError(`This venue can host up to ${maxCapacity} seats at once.`)
      return
    }

    try {
      setIsSubmitting(true)

      const startAtLocal = new Date(`${date}T${startTime}`)
      const endAtLocal = new Date(startAtLocal.getTime() + durationHours * 60 * 60 * 1000)

      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          venueId,
          startAt: startAtLocal.toISOString(),
          endAt: endAtLocal.toISOString(),
          seatCount: seats,
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        // Handle authentication errors - redirect to sign-in with booking data
        if (response.status === 401) {
          // Encode booking data in URL params
          const bookingData = {
            date: date,
            startTime: startTime.replace(":", ""),
            duration: Math.round(durationHours * 60 / 15), // Convert hours to 15min slots
            seats: seats,
          }
          const bookingParam = encodeURIComponent(JSON.stringify(bookingData))
          router.push(`/profile?callbackUrl=${encodeURIComponent(`/venue/${venueId}?booking=${bookingParam}`)}`)
          return
        }
        setError(data?.error || "Failed to create reservation. Please try again.")
        return
      }

      // Open confirmation modal (no redirect)
      setConfirmedReservation(data?.reservation || null)
      setConfirmationOpen(true)
      showToast("Reservation confirmed.", "success")
    } catch (err) {
      console.error("Error creating reservation:", err)
      setError("Something went wrong while creating your reservation.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Date</label>
            <input
              type="date"
              className="rounded-md border bg-background px-3 py-2 text-sm shadow-sm outline-none ring-0 ring-offset-0 focus:border-primary focus:ring-1 focus:ring-primary"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              required
            />
          </div>

          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Start time</label>
            <input
              type="time"
              className="rounded-md border bg-background px-3 py-2 text-sm shadow-sm outline-none ring-0 ring-offset-0 focus:border-primary focus:ring-1 focus:ring-primary"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Duration</label>
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm shadow-sm outline-none ring-0 ring-offset-0 focus:border-primary focus:ring-1 focus:ring-primary"
              value={durationHours}
              onChange={(e) => setDurationHours(Number(e.target.value))}
            >
              {Array.from({ length: 8 }, (_, i) => i + 1).map((h) => (
                <option
                  key={h}
                  value={h}
                >
                  {h} hour{h > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Seats</label>
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm shadow-sm outline-none ring-0 ring-offset-0 focus:border-primary focus:ring-1 focus:ring-primary"
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
            >
              {Array.from({ length: Math.min(8, Math.max(1, maxCapacity)) }, (_, i) => i + 1).map(
                (s) => (
                  <option
                    key={s}
                    value={s}
                  >
                    {s} seat{s > 1 ? "s" : ""}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">Estimated total</span>
          <span className="text-sm font-semibold">
            ${totalPrice.toFixed(0)}
            <span className="ml-1 text-[11px] font-normal text-muted-foreground">
              ({seats} seat{seats > 1 ? "s" : ""} · {durationHours}h)
            </span>
          </span>
        </div>

        {error && (
          <p className="text-xs text-red-600">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="mt-1 w-full"
          size="lg"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Reserving..." : "Reserve seats"}
        </Button>

        <p className="mt-1 text-[11px] text-muted-foreground">
          You’ll only be charged later when we add payments. For now, this reserves your seats
          without payment.
        </p>
      </form>

      {ToastComponent}

      <BookingConfirmationModal
        open={confirmationOpen}
        onOpenChange={setConfirmationOpen}
        reservation={confirmedReservation}
      />
    </>
  )
}

