"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import { MapPin, X } from "lucide-react"
import { BookingConfirmationModal } from "@/components/reservation/BookingConfirmationModal"
import { VenueImageCarousel } from "./VenueImageCarousel"

interface VenueCardProps {
  id: string
  name: string
  address?: string
  city?: string
  state?: string
  minPrice?: number
  maxPrice?: number
  tags?: string[]
  className?: string
  missingLocation?: boolean
  capacity: number
  rulesText?: string
  availabilityLabel?: string
  imageUrls?: string[]
  isExpanded?: boolean
  isDeemphasized?: boolean
  onSelect?: () => void
  onClose?: () => void
  onBookingSuccess?: () => void
  dealBadge?: {
    title: string
    description: string
    type: string
    summary: string
  } | null
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
  city,
  state,
  minPrice = 0,
  maxPrice = 0,
  tags = [],
  className,
  missingLocation = false,
  capacity,
  rulesText,
  availabilityLabel,
  imageUrls = [],
  isExpanded = false,
  isDeemphasized = false,
  onSelect,
  onClose,
  onBookingSuccess,
  dealBadge,
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

  // Format location display: prefer address, then city/state
  const locationDisplay = address || (city && state ? `${city}, ${state}` : city || "")

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

  // Redirect to venue detail page when expanded (for seat-level booking)
  useEffect(() => {
    if (isExpanded) {
      router.push(`/venue/${id}`)
    }
  }, [isExpanded, id, router])

  if (isExpanded) {
    // Show loading state while redirecting
    return (
      <Card className={cn("transition-all", className)}>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">Loading booking...</p>
        </CardContent>
      </Card>
    )
  }


  // Collapsed state
  return (
    <>
      <button
        type="button"
        onClick={() => {
          router.push(`/venue/${id}`)
        }}
        className="w-full text-left"
      >
        <Card
          className={cn(
            "overflow-hidden transition-shadow hover:shadow-md",
            isDeemphasized ? "shadow-none" : "",
            className
          )}
        >
          {/* Image Section with Carousel */}
          <div className="relative">
            <VenueImageCarousel images={imageUrls} enableGallery={false} />
            {/* Badges overlaying top-right of image */}
            <div className="absolute top-2 right-2 z-10 flex flex-col gap-1.5 items-end">
              {/* Availability label */}
              {availabilityLabel && (
                <span
                  className={cn(
                    "rounded-full bg-background/90 backdrop-blur-sm px-2 py-1 text-xs font-medium text-primary shadow-sm",
                    isDeemphasized ? "px-2 py-0.5 text-xs" : "px-2 py-1 text-xs"
                  )}
                >
                  {availabilityLabel}
                </span>
              )}
              {/* Deal Badge directly under availability bubble */}
              {dealBadge && (
                <span
                  className={cn(
                    "rounded-full bg-background/90 backdrop-blur-sm px-2 py-1 text-xs font-medium text-primary shadow-sm",
                    isDeemphasized ? "px-2 py-0.5 text-xs" : "px-2 py-1 text-xs"
                  )}
                >
                  DEAL · {dealBadge.summary}
                </span>
              )}
            </div>
          </div>

          {/* Text Content Below Image */}
          <CardContent className={cn("p-4", isDeemphasized ? "pb-3" : "")}>
            <h3 className={cn(isDeemphasized ? "text-base font-semibold leading-tight" : "text-lg font-semibold leading-tight")}>
              {name}
            </h3>
            {locationDisplay && (
              <div className={cn("mt-1 flex items-center gap-1", dealBadge ? "mt-1" : "mt-1")}>
                <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
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
            {/* Pricing directly under address */}
            <div className="mt-0.5">
              {minPrice === maxPrice ? (
                <p className="text-xs text-muted-foreground">
                  ${minPrice.toFixed(0)} / hour
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  ${minPrice.toFixed(0)}-${maxPrice.toFixed(0)} / hour
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </button>

      <BookingConfirmationModal
        open={confirmationOpen}
        onOpenChange={setConfirmationOpen}
        reservation={confirmedReservation}
      />
    </>
  )
}
