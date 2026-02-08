"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { LoadingOverlay } from "@/components/ui/loading-overlay"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import { MapPin, X } from "lucide-react"
import { BookingConfirmationModal } from "@/components/reservation/BookingConfirmationModal"
import { SignInModal } from "@/components/auth/SignInModal"
import { VenueImageCarousel } from "./VenueImageCarousel"
import { FavoriteButton } from "./FavoriteButton"
import { getLocalDateString } from "@/lib/availability-utils"

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
  isFavorited?: boolean
  onSelect?: () => void
  onClose?: () => void
  onBookingSuccess?: () => void
  onToggleFavorite?: () => void
  dealBadge?: {
    title: string
    description: string
    type: string
    summary: string
  } | null
  initialSeatCount?: number
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
  isFavorited = false,
  onSelect,
  onClose,
  onBookingSuccess,
  onToggleFavorite,
  dealBadge,
  initialSeatCount,
}: VenueCardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const { showToast, ToastComponent } = useToast()
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const [confirmedReservation, setConfirmedReservation] = useState<any>(null)
  
  const [date, setDate] = useState<string>("")
  const [slots, setSlots] = useState<Slot[]>([])
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [durationSlots, setDurationSlots] = useState<number>(4) // 4 * 15min = 1h
  const [seats, setSeats] = useState<number>(initialSeatCount ?? 1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showSignInModal, setShowSignInModal] = useState(false)
  const pendingReservationPayloadRef = useRef<{ venueId: string; startAt: string; endAt: string; seatCount: number } | null>(null)

  // Format location display: prefer address, then city/state
  const locationDisplay = address || (city && state ? `${city}, ${state}` : city || "")

  // Sync initialSeatCount prop with seats state when it changes or venue changes
  useEffect(() => {
    if (initialSeatCount !== undefined && initialSeatCount !== null && initialSeatCount > 0) {
      setSeats(initialSeatCount)
    }
  }, [initialSeatCount, id]) // Reset when venue id changes or initialSeatCount changes

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
      if (date === getLocalDateString(now)) {
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
        if (response.status === 401) {
          pendingReservationPayloadRef.current = {
            venueId: id,
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString(),
            seatCount: seats,
          }
          setShowSignInModal(true)
          return
        }
        
        // Handle PAST_TIME error code specifically
        if (data?.code === "PAST_TIME") {
          setSubmitError(data.error || "This date/time is in the past. Please select a current or future time.")
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
      
      // Refresh reservations page if user is currently on it
      if (pathname === "/reservations") {
        router.refresh()
      }
      
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

  const retryReservation = useCallback(async () => {
    const payload = pendingReservationPayloadRef.current
    if (!payload) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        if (data?.code === "PAST_TIME") {
          setSubmitError(data.error || "This date/time is in the past. Please select a current or future time.")
        } else {
          setSubmitError(data?.error ?? "Failed to create reservation.")
        }
        pendingReservationPayloadRef.current = null
        return
      }
      pendingReservationPayloadRef.current = null
      setConfirmedReservation(data?.reservation || null)
      setConfirmationOpen(true)
      showToast("Reservation confirmed.", "success")
      if (pathname === "/reservations") router.refresh()
      onBookingSuccess?.()
    } catch (error) {
      console.error("Error creating reservation:", error)
      setSubmitError("Something went wrong while creating your reservation.")
      pendingReservationPayloadRef.current = null
    } finally {
      setIsSubmitting(false)
    }
  }, [id, pathname, router, showToast, onBookingSuccess])

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
        <CardContent className="flex flex-col items-center justify-center gap-2 py-8">
          <LoadingSpinner size="md" />
          <p className="text-sm text-muted-foreground">Loading booking...</p>
        </CardContent>
      </Card>
    )
  }


  // Collapsed state
  return (
    <>
      {isPending && (
        <LoadingOverlay label="Loading venue..." zIndex={100} />
      )}
      <button
        type="button"
        onClick={() => {
          const url = initialSeatCount && initialSeatCount > 0
            ? `/venue/${id}?seats=${initialSeatCount}`
            : `/venue/${id}`
          startTransition(() => {
            router.push(url)
          })
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
              {/* Favorite button */}
              <div onClick={(e) => e.stopPropagation()}>
                <FavoriteButton
                  type="venue"
                  itemId={id}
                  initialFavorited={isFavorited}
                  size="sm"
                  className="rounded-full bg-background/90 backdrop-blur-sm p-1 shadow-sm"
                  onToggle={onToggleFavorite}
                />
              </div>
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

      <SignInModal
        open={showSignInModal}
        onOpenChange={(open) => {
          setShowSignInModal(open)
          if (!open) pendingReservationPayloadRef.current = null
        }}
        onSignInSuccess={retryReservation}
        description="Sign in to complete your reservation."
      />
    </>
  )
}
