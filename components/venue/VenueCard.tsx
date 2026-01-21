"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import { MapPin, X } from "lucide-react"
import { BookingConfirmationModal } from "@/components/reservation/BookingConfirmationModal"

interface VenueCardProps {
  id: string
  name: string
  address?: string
  neighborhood?: string
  city?: string
  state?: string
  hourlySeatPrice?: number
  tags?: string[]
  className?: string
  missingLocation?: boolean
  capacity: number
  rulesText?: string
  availabilityLabel?: string
  isExpanded?: boolean
  isDeemphasized?: boolean
  onSelect?: () => void
  onClose?: () => void
  onBookingSuccess?: () => void
}

interface Slot {
  start: string // ISO
  end: string   // ISO
  availableSeats: number
  isFullyBooked: boolean
}

export function VenueCard({
  id,
  name,
  address,
  neighborhood,
  city,
  state,
  hourlySeatPrice = 15,
  tags = [],
  className,
  missingLocation = false,
  capacity,
  rulesText,
  availabilityLabel,
  isExpanded = false,
  isDeemphasized = false,
  onSelect,
  onClose,
  onBookingSuccess,
}: VenueCardProps) {
  const router = useRouter()
  const { showToast, ToastComponent } = useToast()
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const [confirmedReservation, setConfirmedReservation] = useState<any>(null)
  
  const [date, setDate] = useState<string>("")
  const [slots, setSlots] = useState<Slot[]>([])
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [durationSlots, setDurationSlots] = useState<number>(4) // 4 * 15min = 1h
  const [seats, setSeats] = useState<number>(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Format location display: prefer neighborhood, fallback to address, then city/state
  const locationDisplay = neighborhood || address || (city && state ? `${city}, ${state}` : city || "")

  // Initialize date to today
  useEffect(() => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, "0")
    const dd = String(today.getDate()).padStart(2, "0")
    setDate(`${yyyy}-${mm}-${dd}`)
  }, [])

  // Fetch availability slots whenever venue is expanded and date changes
  useEffect(() => {
    if (!isExpanded || !date || !id) return

    const fetchSlots = async () => {
      try {
        setIsLoadingSlots(true)
        setSlotsError(null)
        setSelectedSlot(null)

        const params = new URLSearchParams({ date })
        const res = await fetch(`/api/venues/${id}/availability?` + params.toString())
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
  }, [id, date, isExpanded])

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

    if (seats < 1 || seats > Math.min(8, capacity)) {
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
          venueId: id,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          seatCount: seats,
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        // Handle authentication errors - redirect to sign-in with booking data
        if (response.status === 401) {
          // Encode booking data in URL params
          // Convert slot start time to HHMM format for VenueBookingWidget
          const slotStart = new Date(selectedSlot.start)
          const hours = String(slotStart.getHours()).padStart(2, "0")
          const minutes = String(slotStart.getMinutes()).padStart(2, "0")
          const timeStr = `${hours}${minutes}`
          
          // Convert duration slots (15min) to hours for VenueBookingWidget
          const durationHours = (durationSlots * 15) / 60
          
          const bookingData = {
            date: date,
            startTime: timeStr,
            duration: durationHours,
            seats: seats,
          }
          const bookingParam = encodeURIComponent(JSON.stringify(bookingData))
          router.push(`/profile?callbackUrl=${encodeURIComponent(`/venue/${id}?booking=${bookingParam}`)}`)
          return
        }
        
        // Log error details for debugging
        console.error("Reservation creation failed:", {
          status: response.status,
          error: data?.error,
          details: data?.details,
        })
        
        const errorMessage = data?.error || "Failed to create reservation."
        const detailsMessage = data?.details?.message ? ` (${data.details.message})` : ""
        setSubmitError(errorMessage + detailsMessage)
        return
      }

      showToast("Reservation confirmed.", "success")

      // Open confirmation modal (no redirect)
      setConfirmedReservation(data?.reservation || null)
      setConfirmationOpen(true)
      
      // Call onBookingSuccess callback to refresh availability
      if (onBookingSuccess) {
        onBookingSuccess()
      }
    } catch (error) {
      console.error("Error creating reservation:", error)
      setSubmitError("Something went wrong while creating your reservation.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isExpanded) {
    return (
      <>
        <Card className={cn("transition-all", className)}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold leading-tight">{name}</h3>
                {locationDisplay && (
                  <div className="mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {locationDisplay}
                    </p>
                    {missingLocation && (
                      <span className="ml-2 text-xs text-muted-foreground opacity-50">
                        (location missing)
                      </span>
                    )}
                  </div>
                )}
                <p className="mt-1 text-sm font-medium text-foreground">
                  ${hourlySeatPrice.toFixed(0)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    / seat / hour · {capacity} seats
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
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Booking Form */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-end gap-2">
                <div className="flex-1 flex flex-col">
                  <label className="text-xs font-medium text-muted-foreground mb-1">Date</label>
                  <input
                    type="date"
                    className="w-full rounded-md border bg-background px-2 py-1.5 text-sm shadow-sm outline-none ring-0 ring-offset-0 focus:border-primary focus:ring-1 focus:ring-primary"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-medium text-muted-foreground mb-1">Seats</label>
                  <select
                    className="rounded-md border bg-background px-2 py-1.5 text-sm shadow-sm outline-none ring-0 ring-offset-0 focus:border-primary focus:ring-1 focus:ring-primary"
                    value={seats}
                    onChange={(e) => setSeats(Number(e.target.value))}
                  >
                    {Array.from(
                      { length: Math.min(8, Math.max(1, capacity)) },
                      (_, i) => i + 1
                    ).map((s) => (
                      <option key={s} value={s}>
                        {s} seat{s > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-medium text-muted-foreground mb-1">Duration</label>
                  <select
                    className="rounded-md border bg-background px-2 py-1.5 text-sm shadow-sm outline-none ring-0 ring-offset-0 focus:border-primary focus:ring-1 focus:ring-primary"
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
                        <option key={slotsCount} value={slotsCount}>
                          {label}
                        </option>
                      )
                    })}
                  </select>
                </div>
              </div>

              {/* Time Slots */}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Start time
                </p>
                <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
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
                          className={cn(
                            "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                            disabled
                              ? "border-muted-foreground/20 bg-muted text-muted-foreground/60 line-through cursor-not-allowed"
                              : isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted-foreground/20 bg-background text-foreground hover:border-primary/60"
                          )}
                        >
                          {label}
                        </button>
                      )
                    })}
                </div>
              </div>

              {/* Rules Text */}
              {rulesText && (
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">House rules</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-line">
                    {rulesText}
                  </p>
                </div>
              )}

              {/* Error Message */}
              {submitError && (
                <p className="text-xs text-red-600">{submitError}</p>
              )}

              {/* Reserve Button */}
              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-muted-foreground">
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
          </CardContent>
        </Card>
        {ToastComponent}

        <BookingConfirmationModal
          open={confirmationOpen}
          onOpenChange={setConfirmationOpen}
          reservation={confirmedReservation}
        />
      </>
    )
  }

  // Collapsed state
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left"
    >
      <Card
        className={cn(
          "transition-shadow hover:shadow-md",
          isDeemphasized ? "shadow-none" : "",
          className
        )}
      >
        <CardHeader className={cn(isDeemphasized ? "pb-2 pt-3" : "pb-3")}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className={cn(isDeemphasized ? "text-base font-semibold leading-tight" : "text-lg font-semibold leading-tight")}>
                {name}
              </h3>
              {locationDisplay && (
                <div className="mt-1 flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  <p className={cn(isDeemphasized ? "text-xs text-muted-foreground" : "text-sm text-muted-foreground")}>
                    {locationDisplay}
                  </p>
                  {missingLocation && (
                    <span className="ml-2 text-xs text-muted-foreground opacity-50">
                      (location missing)
                    </span>
                  )}
                </div>
              )}
            </div>
            {availabilityLabel && (
              <span className={cn(
                "ml-2 rounded-full bg-primary/10 font-medium text-primary",
                isDeemphasized ? "px-2 py-0.5 text-[11px]" : "px-2 py-1 text-xs"
              )}>
                {availabilityLabel}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className={cn("pt-0", isDeemphasized ? "pb-3" : "")}>
          <div className="flex items-center justify-between">
            <div className={cn(isDeemphasized ? "text-sm font-medium text-foreground" : "text-base font-medium text-foreground")}>
              ${hourlySeatPrice.toFixed(2)}
              <span className={cn(isDeemphasized ? "ml-1 text-xs font-normal text-muted-foreground" : "ml-1 text-sm font-normal text-muted-foreground")}>
                / seat / hour
              </span>
            </div>
            {/* Deemphasized cards collapse tags for a smaller, calmer list */}
            {!isDeemphasized && tags.length > 0 && (
              <div className="flex gap-1">
                {tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <BookingConfirmationModal
        open={confirmationOpen}
        onOpenChange={setConfirmationOpen}
        reservation={confirmedReservation}
      />
    </button>
  )
}
