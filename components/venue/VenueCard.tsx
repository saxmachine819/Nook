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
      const startTimeValue = startAt.getHours() * 100 + startAt.getMinutes()
      const bookingParam = encodeURIComponent(
        JSON.stringify({
          date: getLocalDateString(startAt),
          startTime: startTimeValue,
          duration: durationSlots / 4,
        })
      )

      showToast("Select seats to continue checkout.", "success")
      router.push(`/venue/${id}?seats=${seats}&booking=${bookingParam}`)
    } catch (error) {
      console.error("Error starting checkout:", error)
      setSubmitError("Something went wrong while starting checkout.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const retryReservation = useCallback(async () => {
    pendingReservationPayloadRef.current = null
  }, [])

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
        className="w-full text-left outline-none"
      >
        <Card
          className={cn(
            "group overflow-hidden border-none bg-card transition-all duration-300 hover:premium-shadow active:scale-[0.98]",
            isDeemphasized ? "shadow-none" : "premium-shadow",
            className
          )}
        >
          {/* Image Section with Carousel */}
          <div className="relative overflow-hidden">
            <VenueImageCarousel images={imageUrls} enableGallery={false} className="transition-transform duration-500 group-hover:scale-105" />

            {/* Gradient Overlay for badges visibility */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-transparent pointer-events-none" />

            {/* Badges overlaying top-right of image */}
            <div className="absolute top-3 right-3 z-10 flex flex-col gap-2 items-end">
              {/* Favorite button */}
              <div onClick={(e) => e.stopPropagation()}>
                <FavoriteButton
                  type="venue"
                  itemId={id}
                  initialFavorited={isFavorited}
                  size="sm"
                  className="rounded-full glass-dark p-2 text-white shadow-lg transition-transform hover:scale-110 active:scale-90"
                  onToggle={onToggleFavorite}
                />
              </div>
              {/* Availability label */}
              {availabilityLabel && (
                <span
                  className={cn(
                    "rounded-full glass-dark px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg",
                    isDeemphasized ? "py-0.5" : ""
                  )}
                >
                  {availabilityLabel}
                </span>
              )}
              {/* Deal Badge */}
              {dealBadge && (
                <span
                  className={cn(
                    "rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg animate-pulse",
                    isDeemphasized ? "py-0.5" : ""
                  )}
                >
                  {dealBadge.summary}
                </span>
              )}
            </div>
          </div>

          {/* Text Content Below Image */}
          <CardContent className={cn("p-4 space-y-1.5", isDeemphasized ? "pb-3" : "")}>
            <div className="flex justify-between items-start gap-2">
              <h3 className={cn("font-bold tracking-tight text-foreground/90 transition-colors group-hover:text-primary", isDeemphasized ? "text-base" : "text-lg")}>
                {name}
              </h3>
              <div className="shrink-0 flex flex-col items-end">
                <p className="text-sm font-bold text-primary">
                  ${minPrice.toFixed(0)}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">/ hr</p>
              </div>
            </div>

            {locationDisplay && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                <p className={cn("text-muted-foreground font-medium", isDeemphasized ? "text-xs" : "text-sm")}>
                  {locationDisplay}
                </p>
                {missingLocation && (
                  <span className="text-[10px] text-destructive/50 font-medium italic">
                    (hidden)
                  </span>
                )}
              </div>
            )}

            {/* Trust Tags or other info could go here if available */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.slice(0, 3).map((tag, i) => (
                  <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/5 text-primary/70 border border-primary/10">
                    {tag}
                  </span>
                ))}
              </div>
            )}
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

