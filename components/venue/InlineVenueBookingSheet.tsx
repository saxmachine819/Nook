"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"

interface InlineVenue {
  id: string
  name: string
  address: string
  city?: string
  state?: string
  hourlySeatPrice: number
  tags: string[]
  capacity: number
  rulesText?: string
}

interface InlineVenueBookingSheetProps {
  venue: InlineVenue
  onClose: () => void
}

interface Slot {
  start: string // ISO
  end: string   // ISO
  availableSeats: number
  isFullyBooked: boolean
}

export function InlineVenueBookingSheet({ venue, onClose }: InlineVenueBookingSheetProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { showToast, ToastComponent } = useToast()

  const [date, setDate] = useState<string>("")
  const [slots, setSlots] = useState<Slot[]>([])
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [slotsError, setSlotsError] = useState<string | null>(null)

  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [durationSlots, setDurationSlots] = useState<number>(4) // 4 * 15min = 1h
  const [seats, setSeats] = useState<number>(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Initialize date to today
  useEffect(() => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, "0")
    const dd = String(today.getDate()).padStart(2, "0")
    setDate(`${yyyy}-${mm}-${dd}`)
  }, [])

  // Fetch availability slots whenever venue or date changes
  useEffect(() => {
    if (!date || !venue.id) return

    const fetchSlots = async () => {
      try {
        setIsLoadingSlots(true)
        setSlotsError(null)
        setSelectedSlot(null)

        const params = new URLSearchParams({ date })
        const res = await fetch(`/api/venues/${venue.id}/availability?` + params.toString())
        const data = await res.json().catch(() => null)

        if (!res.ok) {
          setSlotsError(data?.error || "Failed to load availability.")
          setSlots([])
          return
        }

        setSlots(data.slots || [])
      } catch (error) {
        console.error("Error fetching slots:", error)
        setSlotsError("Failed to load availability.")
        setSlots([])
      } finally {
        setIsLoadingSlots(false)
      }
    }

    fetchSlots()
  }, [venue.id, date])

  const upcomingSlots = useMemo(() => {
    if (!slots.length) return []
    const now = new Date()
    return slots.filter((slot) => {
      const start = new Date(slot.start)
      // Only show slots in the future for today; for other days, show all.
      if (date === now.toISOString().split("T")[0]) {
        return start > now
      }
      return true
    })
  }, [slots, date])

  const handleBook = async () => {
    if (!selectedSlot) {
      setSubmitError("Please pick a start time.")
      return
    }

    if (seats < 1 || seats > Math.min(8, venue.capacity)) {
      setSubmitError("Please choose a valid number of seats.")
      return
    }

    setSubmitError(null)

    try {
      setIsSubmitting(true)

      const startAt = new Date(selectedSlot.start)
      const endAt = new Date(startAt.getTime() + durationSlots * 15 * 60 * 1000)

      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          venueId: venue.id,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          seatCount: seats,
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setSubmitError(data?.error || "Failed to create reservation.")
        return
      }

      showToast("Reservation confirmed.", "success")

      // Refresh reservations page if user is currently on it
      if (pathname === "/reservations") {
        router.refresh()
      }

      // Refresh slots to reflect new booking
      setTimeout(() => {
        setSelectedSlot(null)
        setSubmitError(null)
        // Force refetch by updating date to same value
        setDate((prev) => prev)
      }, 400)
    } catch (error) {
      console.error("Error creating reservation:", error)
      setSubmitError("Something went wrong while creating your reservation.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const locationDisplay =
    venue.address ||
    (venue.city && venue.state ? `${venue.city}, ${venue.state}` : venue.city || "")

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-16 z-40 flex justify-center px-4 pb-2">
        <div className="pointer-events-auto w-full max-w-md rounded-2xl border bg-background/95 p-4 shadow-xl backdrop-blur">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-base font-semibold leading-tight">
                {venue.name}
              </h2>
              {locationDisplay && (
                <p className="text-xs text-muted-foreground">
                  {locationDisplay}
                </p>
              )}
              <p className="text-xs font-medium text-foreground">
                ${venue.hourlySeatPrice.toFixed(0)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  / seat / hour · {venue.capacity} seats
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-3 flex items-center gap-2">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground">Date</label>
              <input
                type="date"
                className="mt-0.5 w-full rounded-md border bg-background px-2 py-1.5 text-xs shadow-sm outline-none ring-0 ring-offset-0 focus:border-primary focus:ring-1 focus:ring-primary"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-muted-foreground">Seats</label>
              <select
                className="mt-0.5 rounded-md border bg-background px-2 py-1.5 text-xs shadow-sm outline-none ring-0 ring-offset-0 focus:border-primary focus:ring-1 focus:ring-primary"
                value={seats}
                onChange={(e) => setSeats(Number(e.target.value))}
              >
                {Array.from(
                  { length: Math.min(8, Math.max(1, venue.capacity)) },
                  (_, i) => i + 1
                ).map((s) => (
                  <option
                    key={s}
                    value={s}
                  >
                    {s} seat{s > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-muted-foreground">Duration</label>
              <select
                className="mt-0.5 rounded-md border bg-background px-2 py-1.5 text-xs shadow-sm outline-none ring-0 ring-offset-0 focus:border-primary focus:ring-1 focus:ring-primary"
                value={durationSlots}
                onChange={(e) => setDurationSlots(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 6, 8, 12, 16].map((slotsCount) => {
                  const minutes = slotsCount * 15
                  const hours = minutes / 60
                  const label =
                    minutes < 60
                      ? `${minutes} min`
                      : `${hours} hr${hours > 1 ? "s" : ""}`
                  return (
                    <option
                      key={slotsCount}
                      value={slotsCount}
                    >
                      {label}
                    </option>
                  )
                })}
              </select>
            </div>
          </div>

          <div className="mb-2">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Start time
            </p>
            <div className="no-scrollbar flex gap-1 overflow-x-auto pb-1">
              {isLoadingSlots && (
                <p className="text-xs text-muted-foreground">Loading times…</p>
              )}
              {!isLoadingSlots && slotsError && (
                <p className="text-xs text-red-600">{slotsError}</p>
              )}
              {!isLoadingSlots && !slotsError && upcomingSlots.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No more times today. Try another date.
                </p>
              )}
              {!isLoadingSlots &&
                !slotsError &&
                upcomingSlots.map((slot) => {
                  const start = new Date(slot.start)
                  const label = start.toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })
                  const isSelected = selectedSlot?.start === slot.start
                  const disabled = slot.isFullyBooked || slot.availableSeats <= 0

                  return (
                    <button
                      key={slot.start}
                      type="button"
                      disabled={disabled}
                      onClick={() => setSelectedSlot(slot)}
                      className={[
                        "whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium",
                        disabled
                          ? "border-muted-foreground/20 bg-muted text-muted-foreground/60 line-through"
                          : isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/20 bg-background text-foreground hover:border-primary/60",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  )
                })}
            </div>
          </div>

          {submitError && (
            <p className="mb-1 text-xs text-red-600">
              {submitError}
            </p>
          )}

          <div className="mt-1 flex items-center justify-between">
            <div className="text-[11px] text-muted-foreground">
              {selectedSlot ? (
                <span>
                  Starting at{" "}
                  {new Date(selectedSlot.start).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              ) : (
                <span>Choose a start time to continue</span>
              )}
            </div>
            <Button
              size="sm"
              className="px-4 text-xs"
              disabled={isSubmitting || !selectedSlot}
              onClick={handleBook}
            >
              {isSubmitting ? "Reserving..." : "Reserve"}
            </Button>
          </div>
        </div>
      </div>

      {ToastComponent}
    </>
  )
}

