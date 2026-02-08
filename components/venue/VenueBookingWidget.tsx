"use client"

import { useEffect, useMemo, useState, useCallback, useRef } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { BookingConfirmationModal } from "@/components/reservation/BookingConfirmationModal"
import { SeatCard } from "@/components/venue/SeatCard"
import { ImageGalleryModal } from "@/components/ui/ImageGalleryModal"
import { SignInModal } from "@/components/auth/SignInModal"
import { cn } from "@/lib/utils"
import { roundUpToNext15Minutes, getLocalDateString } from "@/lib/availability-utils"

interface Table {
  id: string
  name: string | null
  imageUrls: string[] | null
  seats: Array<{
    id: string
    label: string | null
    position: number | null
    pricePerHour: number
    tags: string[] | null
    imageUrls: string[] | null
  }>
}

interface VenueBookingWidgetProps {
  venueId: string
  tables: Table[]
  favoritedTableIds?: Set<string>
  favoritedSeatIds?: Set<string>
}

interface AvailableSeat {
  id: string
  tableId: string
  tableName: string | null
  label: string | null
  position: number | null
  pricePerHour: number
  tags: string[]
  imageUrls: string[]
  tableImageUrls: string[]
  isCommunal?: boolean
}

interface AvailableSeatGroup {
  seats: AvailableSeat[]
  tableId: string
  totalPricePerHour: number
}

interface AvailableGroupTable {
  id: string
  name: string | null
  seatCount: number
  pricePerHour: number
  imageUrls: string[]
  isCommunal?: boolean
  nextAvailableAt?: string | null
}

interface UnavailableSeat extends AvailableSeat {
  nextAvailableAt: string | null
}

interface UnavailableGroupTable extends AvailableGroupTable {
  nextAvailableAt: string | null
}

export function VenueBookingWidget({
  venueId,
  tables,
  favoritedTableIds = new Set(),
  favoritedSeatIds = new Set(),
}: VenueBookingWidgetProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { showToast, ToastComponent } = useToast()
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const [confirmedReservation, setConfirmedReservation] = useState<any>(null)

  // Get initial seat count from URL params if available
  const initialSeatCountFromUrl = searchParams?.get("seats")
  const parsedInitialSeatCount = initialSeatCountFromUrl 
    ? parseInt(initialSeatCountFromUrl, 10) 
    : null
  const validInitialSeatCount = parsedInitialSeatCount && parsedInitialSeatCount > 0 
    ? parsedInitialSeatCount 
    : null

  // Get preselected resource from QR code scan
  const resourceTypeFromUrl = searchParams?.get("resourceType")
  const resourceIdFromUrl = searchParams?.get("resourceId")

  // #region agent log
  useEffect(() => {
    fetch("http://127.0.0.1:7242/ingest/b5111244-c4ed-4ea6-9398-28181fe79047", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "VenueBookingWidget:mount", message: "URL params for preselection", data: { resourceTypeFromUrl, resourceIdFromUrl, fullUrl: typeof window !== "undefined" ? window.location.href : "" }, timestamp: Date.now(), sessionId: "debug-session", hypothesisId: "H2" }) }).catch(() => {})
  }, [resourceTypeFromUrl, resourceIdFromUrl])
  // #endregion

  const [date, setDate] = useState<string>("")
  const [startTime, setStartTime] = useState<string>("")
  const [durationHours, setDurationHours] = useState<number>(2)
  const [seatCount, setSeatCount] = useState<number>(validInitialSeatCount ?? 1)
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null)
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([])
  const [selectedGroupTableId, setSelectedGroupTableId] = useState<string | null>(null)
  const [preselectedSeatId, setPreselectedSeatId] = useState<string | null>(
    resourceTypeFromUrl === "seat" && resourceIdFromUrl ? resourceIdFromUrl : null
  )
  const [preselectedTableId, setPreselectedTableId] = useState<string | null>(
    resourceTypeFromUrl === "table" && resourceIdFromUrl ? resourceIdFromUrl : null
  )
  const [availableSeats, setAvailableSeats] = useState<AvailableSeat[]>([])
  const [unavailableSeats, setUnavailableSeats] = useState<UnavailableSeat[]>([])
  const [availableSeatGroups, setAvailableSeatGroups] = useState<AvailableSeatGroup[]>([])
  const [availableGroupTables, setAvailableGroupTables] = useState<AvailableGroupTable[]>([])
  const [unavailableGroupTables, setUnavailableGroupTables] = useState<UnavailableGroupTable[]>([])
  const [unavailableSeatIds, setUnavailableSeatIds] = useState<Set<string>>(
    new Set()
  )

  const [isImageOpen, setIsImageOpen] = useState(false)
  const [imageModalImages, setImageModalImages] = useState<string[]>([])
  const [imageModalInitialIndex, setImageModalInitialIndex] = useState(0)

  const openImageModal = useCallback((images: string[], initialIndex = 0) => {
    if (!images || images.length === 0) return
    setImageModalImages(images)
    setImageModalInitialIndex(initialIndex)
    setIsImageOpen(true)
  }, [])
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSignInModal, setShowSignInModal] = useState(false)
  const pendingReservationPayloadRef = useRef<any>(null)

  const handleCheckAvailability = useCallback(async () => {
    if (!date || !startTime) {
      setError("Please select a date and start time first.")
      return
    }

    setIsLoadingAvailability(true)
    setError(null)
    // Don't clear selections if we have a preselected resource - wait to see if it's available
    if (!preselectedSeatId && !preselectedTableId) {
      setSelectedSeatId(null)
      setSelectedSeatIds([])
      setSelectedGroupTableId(null)
    }

    try {
      const startAtLocal = new Date(`${date}T${startTime}`)
      const endAtLocal = new Date(
        startAtLocal.getTime() + durationHours * 60 * 60 * 1000
      )

      // Validate that start time is not in the past
      const now = new Date()
      if (startAtLocal < now) {
        setError("This date/time is in the past. Please select a current or future time.")
        setIsLoadingAvailability(false)
        return
      }

      const response = await fetch(
        `/api/venues/${venueId}/availability?startAt=${encodeURIComponent(
          startAtLocal.toISOString()
        )}&endAt=${encodeURIComponent(endAtLocal.toISOString())}&seatCount=${seatCount}`
      )

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        console.error("Availability check failed:", response.status, data)
        setError(data?.error || "Failed to check availability.")
        setAvailableSeats([])
        setUnavailableSeats([])
        setAvailableSeatGroups([])
        setAvailableGroupTables([])
        setUnavailableGroupTables([])
        setUnavailableSeatIds(new Set())
        return
      }

      // Check for opening hours error or capacity error
      if (data.error) {
        console.error("Availability error:", data.error)
        setError(data.error)
        setAvailableSeats([])
        setUnavailableSeats([])
        setAvailableSeatGroups([])
        setAvailableGroupTables([])
        setUnavailableGroupTables([])
        setUnavailableSeatIds(new Set())
        return
      }

      // Venue paused: show message and block booking
      if (data.bookingDisabled) {
        setError(data.pauseMessage || "This venue is temporarily not accepting reservations.")
        setAvailableSeats([])
        setUnavailableSeats([])
        setAvailableSeatGroups([])
        setAvailableGroupTables([])
        setUnavailableGroupTables([])
        setUnavailableSeatIds(new Set())
        return
      }

      // Validate response structure
      if (!data || typeof data !== 'object') {
        console.error("Invalid response structure:", data)
        setError("Invalid response from server.")
        setAvailableSeats([])
        setUnavailableSeats([])
        setAvailableSeatGroups([])
        setAvailableGroupTables([])
        setUnavailableGroupTables([])
        setUnavailableSeatIds(new Set())
        return
      }

      console.log("Availability check successful:", {
        availableSeats: data.availableSeats?.length || 0,
        unavailableSeats: data.unavailableSeats?.length || 0,
        availableSeatGroups: data.availableSeatGroups?.length || 0,
        availableGroupTables: data.availableGroupTables?.length || 0,
        unavailableGroupTables: data.unavailableGroupTables?.length || 0,
        unavailableSeatIds: data.unavailableSeatIds?.length || 0
      })

      setAvailableSeats(data.availableSeats || [])
      setUnavailableSeats(data.unavailableSeats || [])
      setAvailableSeatGroups(data.availableSeatGroups || [])
      setAvailableGroupTables(data.availableGroupTables || [])
      setUnavailableGroupTables(data.unavailableGroupTables || [])
      setUnavailableSeatIds(new Set(data.unavailableSeatIds || []))

      // Auto-select preselected seat/table if available
      if (preselectedSeatId) {
        const preselectedSeat = (data.availableSeats || []).find((s: AvailableSeat) => s.id === preselectedSeatId)
        // #region agent log
        fetch("http://127.0.0.1:7242/ingest/b5111244-c4ed-4ea6-9398-28181fe79047", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "VenueBookingWidget:preselectSeat", message: "Preselection seat result", data: { preselectedSeatId, foundSeat: !!preselectedSeat, availableSeatIds: (data.availableSeats || []).map((s: AvailableSeat) => s.id).slice(0, 5) }, timestamp: Date.now(), sessionId: "debug-session", hypothesisId: "H3" }) }).catch(() => {})
        // #endregion
        if (preselectedSeat) {
          setSelectedSeatId(preselectedSeatId)
          setSeatCount(1) // Individual seat selection
          showToast("Pre-selected seat from QR code", "success")
        }
      } else if (preselectedTableId) {
        const availableGroupTables = data.availableGroupTables || []
        const preselectedTable = availableGroupTables.find((t: AvailableGroupTable) => t.id === preselectedTableId)
        // #region agent log
        fetch("http://127.0.0.1:7242/ingest/b5111244-c4ed-4ea6-9398-28181fe79047", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "VenueBookingWidget:preselectTable", message: "Preselection table result", data: { preselectedTableId, foundTable: !!preselectedTable, availableGroupTablesCount: availableGroupTables.length, availableTableIds: availableGroupTables.map((t: AvailableGroupTable) => t.id).slice(0, 8), note: !preselectedTable ? "Table not in availableGroupTables (may be individual booking mode)" : null }, timestamp: Date.now(), sessionId: "debug-session", hypothesisId: "H3" }) }).catch(() => {})
        // #endregion
        if (preselectedTable) {
          setSelectedGroupTableId(preselectedTableId)
          setSeatCount(preselectedTable.seatCount)
          showToast("Pre-selected table from QR code", "success")
        }
      }
    } catch (err) {
      console.error("Error checking availability:", err)
      setError("Something went wrong while checking availability.")
      setAvailableSeats([])
      setUnavailableSeats([])
      setAvailableSeatGroups([])
      setAvailableGroupTables([])
      setUnavailableGroupTables([])
      setUnavailableSeatIds(new Set())
    } finally {
      setIsLoadingAvailability(false)
    }
  }, [date, startTime, durationHours, venueId, seatCount, preselectedSeatId, preselectedTableId, showToast])

  // Track if we've initialized date/time to prevent re-initialization
  const hasInitialized = useRef(false)
  const handleCheckAvailabilityRef = useRef(handleCheckAvailability)
  const hasAutoChecked = useRef(false)

  // Keep ref updated with latest handleCheckAvailability
  useEffect(() => {
    handleCheckAvailabilityRef.current = handleCheckAvailability
  }, [handleCheckAvailability])

  // Restore booking data from URL params if present (after sign-in)
  useEffect(() => {
    const bookingParam = searchParams?.get("booking")
    if (bookingParam) {
      try {
        const bookingData = JSON.parse(decodeURIComponent(bookingParam))
        if (bookingData.date) setDate(bookingData.date)
        if (bookingData.startTime) {
          const timeStr = String(bookingData.startTime).padStart(4, "0")
          if (timeStr.length === 4) {
            setStartTime(`${timeStr.slice(0, 2)}:${timeStr.slice(2)}`)
          }
        }
        if (bookingData.duration !== undefined) {
          setDurationHours(bookingData.duration)
        }
        if (bookingData.seatId) setSelectedSeatId(bookingData.seatId)

        const newUrl = new URL(window.location.href)
        newUrl.searchParams.delete("booking")
        router.replace(newUrl.pathname + newUrl.search, { scroll: false })

        // Auto-fetch availability if time is set
        if (bookingData.date && bookingData.startTime) {
          setTimeout(() => {
            handleCheckAvailabilityRef.current()
          }, 200)
        }
        hasInitialized.current = true
      } catch (e) {
        console.error("Failed to parse booking data:", e)
      }
      return
    }

    // Default initialization - only run once on mount
    if (!hasInitialized.current && date === "" && startTime === "") {
      const now = new Date()
      const rounded = roundUpToNext15Minutes(now)

      const yyyy = rounded.getFullYear()
      const mm = String(rounded.getMonth() + 1).padStart(2, "0")
      const dd = String(rounded.getDate()).padStart(2, "0")
      const hh = String(rounded.getHours()).padStart(2, "0")
      const min = String(rounded.getMinutes()).padStart(2, "0")

      setDate(`${yyyy}-${mm}-${dd}`)
      setStartTime(`${hh}:${min}`)
      hasInitialized.current = true
      
      // Auto-trigger availability check after setting date/time
      // Also trigger if we have preselected resource from QR code
      setTimeout(() => {
        if (!hasAutoChecked.current && !searchParams?.get("booking")) {
          hasAutoChecked.current = true
          handleCheckAvailabilityRef.current()
        }
      }, 150)
    }
  }, [searchParams, router, preselectedSeatId, preselectedTableId])

  // Group available and unavailable seats by table
  const seatsByTable = useMemo(() => {
    const grouped = new Map<string, { available: AvailableSeat[]; unavailable: UnavailableSeat[] }>()
    
    availableSeats.forEach((seat) => {
      if (!grouped.has(seat.tableId)) {
        grouped.set(seat.tableId, { available: [], unavailable: [] })
      }
      grouped.get(seat.tableId)!.available.push(seat)
    })
    
    unavailableSeats.forEach((seat) => {
      if (!grouped.has(seat.tableId)) {
        grouped.set(seat.tableId, { available: [], unavailable: [] })
      }
      grouped.get(seat.tableId)!.unavailable.push(seat)
    })
    
    return grouped
  }, [availableSeats, unavailableSeats])

  // Get table info for display
  const getTableInfo = (tableId: string) => {
    const table = tables.find((t) => t.id === tableId)
    if (!table) return null
    
    // Parse imageUrls from JSON if needed
    const imageUrls = Array.isArray(table.imageUrls) 
      ? table.imageUrls 
      : table.imageUrls 
        ? (typeof table.imageUrls === 'string' ? JSON.parse(table.imageUrls) : table.imageUrls)
        : []
    
    return {
      ...table,
      imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
    }
  }

  // Calculate total price for selected seat(s) or table
  const totalPrice = useMemo(() => {
    if (!durationHours) return 0
    
    // Group table selection
    if (selectedGroupTableId) {
      const table = availableGroupTables.find((t) => t.id === selectedGroupTableId)
      if (!table) return 0
      return table.pricePerHour * durationHours
    }
    
    // Individual seat selection
    if (seatCount === 1 && selectedSeatId) {
      const seat = availableSeats.find((s) => s.id === selectedSeatId)
      if (!seat) return 0
      return seat.pricePerHour * durationHours
    }
    
    // Multi-seat selection
    if (seatCount > 1 && selectedSeatIds.length > 0) {
      const selectedSeats = availableSeats.filter((s) => selectedSeatIds.includes(s.id))
      const totalPricePerHour = selectedSeats.reduce((sum, seat) => sum + seat.pricePerHour, 0)
      return totalPricePerHour * durationHours
    }
    
    return 0
  }, [selectedSeatId, selectedSeatIds, selectedGroupTableId, durationHours, availableSeats, availableGroupTables, seatCount])

  const canCheckAvailability = date && startTime && !isLoadingAvailability;
  
  const hasSingleSeatData = seatCount === 1 && (availableSeats.length > 0 || unavailableSeats.length > 0 || availableGroupTables.length > 0 || unavailableGroupTables.length > 0);
  const hasMultiSeatData = seatCount > 1 && (availableSeatGroups.length > 0 || availableGroupTables.length > 0 || unavailableGroupTables.length > 0);
  const hasAvailabilityData = hasSingleSeatData || hasMultiSeatData;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!date || !startTime) {
      setError("Please select a date and start time.")
      return
    }

    if (!hasAvailabilityData) {
      setError("Please click 'Check availability' first to see available seats.")
      return
    }

    // Check if user has selected either individual seats OR a group table
    const hasIndividualSelection = seatCount === 1 && selectedSeatId
    const hasMultiSeatSelection = seatCount > 1 && selectedSeatIds.length === seatCount
    const hasGroupTableSelection = selectedGroupTableId !== null

    if (!hasIndividualSelection && !hasMultiSeatSelection && !hasGroupTableSelection) {
      if (seatCount === 1) {
        setError("Please select a seat or table from the available options below.")
      } else {
        setError(`Please select ${seatCount} seats or a table from the available options below.`)
      }
      return
    }

    if (durationHours < 1 || durationHours > 8) {
      setError("Duration must be between 1 and 8 hours.")
      return
    }

    try {
      setIsSubmitting(true)

      const startAtLocal = new Date(`${date}T${startTime}`)
      const endAtLocal = new Date(
        startAtLocal.getTime() + durationHours * 60 * 60 * 1000
      )

      // Client-side validation: check if start time is in the past
      const now = new Date()
      if (startAtLocal < now) {
        setError("This date/time is in the past. Please select a current or future time.")
        setIsSubmitting(false)
        return
      }

      // Determine what to book: group table or individual seats
      let requestBody: any = {
        venueId,
        startAt: startAtLocal.toISOString(),
        endAt: endAtLocal.toISOString(),
      }

      if (selectedGroupTableId) {
        // Booking a group table
        const selectedTable = availableGroupTables.find((t) => t.id === selectedGroupTableId)
        if (!selectedTable) {
          setError("Selected table not found. Please try again.")
          return
        }
        requestBody.tableId = selectedGroupTableId
        // IMPORTANT: seatCount for group bookings should be the table's seat count,
        // not the current seat selector value (which is often still 1).
        requestBody.seatCount = selectedTable.seatCount
      } else {
        // Booking individual seats
        const seatIds = seatCount === 1 
          ? [selectedSeatId!]
          : selectedSeatIds
        requestBody.seatIds = seatIds
      }

      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        if (response.status === 401) {
          pendingReservationPayloadRef.current = requestBody
          setShowSignInModal(true)
          return
        }
        // Handle PAST_TIME error code specifically
        if (data?.code === "PAST_TIME") {
          setError(data.error || "This date/time is in the past. Please select a current or future time.")
        } else {
          setError(data?.error || "Failed to create reservation. Please try again.")
        }
        return
      }

      setConfirmedReservation(data?.reservation || null)
      setConfirmationOpen(true)
      showToast("Reservation confirmed.", "success")
      
      // Refresh reservations page if user is currently on it
      if (pathname === "/reservations") {
        router.refresh()
      }
    } catch (err) {
      console.error("Error creating reservation:", err)
      setError("Something went wrong while creating your reservation.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const retryReservation = useCallback(async () => {
    const payload = pendingReservationPayloadRef.current
    if (!payload) return
    setIsSubmitting(true)
    setError(null)
    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        if (data?.code === "PAST_TIME") {
          setError(data.error || "This date/time is in the past. Please select a current or future time.")
        } else {
          setError(data?.error || "Failed to create reservation. Please try again.")
        }
        pendingReservationPayloadRef.current = null
        return
      }
      pendingReservationPayloadRef.current = null
      setConfirmedReservation(data?.reservation || null)
      setConfirmationOpen(true)
      showToast("Reservation confirmed.", "success")
      if (pathname === "/reservations") router.refresh()
    } catch (err) {
      console.error("Error creating reservation:", err)
      setError("Something went wrong while creating your reservation.")
      pendingReservationPayloadRef.current = null
    } finally {
      setIsSubmitting(false)
    }
  }, [pathname, showToast])

  // Helper function to render single seat selection
  const renderSingleSeatSelection = () => {
    const hasAnySeats = availableSeats.length > 0 || unavailableSeats.length > 0
    const hasAnyTables = availableGroupTables.length > 0 || unavailableGroupTables.length > 0
    
    if (!hasAnySeats && !hasAnyTables) {
      return (
        <p className="text-sm text-muted-foreground">
          No seats or tables available for this time. Try a different time or date.
        </p>
      )
    }

    return (
      <>
        {/* Group tables section */}
        {(availableGroupTables.length > 0 || unavailableGroupTables.length > 0) && (
          <div className="mb-6 space-y-3">
            <h4 className="text-xs font-medium text-muted-foreground">
              Book full table
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Available group tables */}
              {availableGroupTables.map((table) => {
                const isSelected = selectedGroupTableId === table.id
                return (
                  <button
                    key={table.id}
                    type="button"
                    onClick={() => {
                      setSelectedGroupTableId(table.id)
                      setSelectedSeatId(null)
                      setSelectedSeatIds([])
                    }}
                    className={cn(
                      "relative rounded-md border p-4 text-left transition-all",
                      "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                      isSelected
                        ? "border-primary ring-2 ring-primary"
                        : "border-muted hover:border-primary/50"
                    )}
                  >
                    {table.imageUrls.length > 0 && (
                      <div
                        className="mb-2 aspect-video w-full overflow-hidden rounded-md cursor-zoom-in"
                        onClick={(e) => {
                          // Don't select the table when user is just trying to view photos
                          e.preventDefault()
                          e.stopPropagation()
                          openImageModal(table.imageUrls, 0)
                        }}
                      >
                        <img
                          src={table.imageUrls[0]}
                          alt={table.name || "Table"}
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <h5 className="text-sm font-medium">
                        {table.name || "Table"}
                      </h5>
                      {table.isCommunal === true && (
                        <span className="flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          <svg
                            className="h-2.5 w-2.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                            />
                          </svg>
                          Communal
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {table.seatCount} seat{table.seatCount > 1 ? "s" : ""}
                      {table.isCommunal === true && (
                        <span className="block mt-1 text-[10px] italic">
                          Note: This is a communal space. Other guests may be seated at the same table.
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      ${table.pricePerHour.toFixed(0)}/hour <span className="text-xs font-normal text-muted-foreground">(total)</span>
                    </p>
                    {isSelected && (
                      <div className="absolute right-2 top-2">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <svg
                            className="h-3 w-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      </div>
                    )}
                  </button>
                )
              })}
              {/* Unavailable group tables */}
              {unavailableGroupTables.map((table) => {
                const isSelected = false // Unavailable tables can't be selected
                const nextAvailableTime = table.nextAvailableAt
                  ? new Date(table.nextAvailableAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : null
                
                return (
                  <button
                    key={table.id}
                    type="button"
                    disabled
                    className={cn(
                      "relative rounded-md border p-4 text-left transition-all",
                      "cursor-not-allowed opacity-50"
                    )}
                  >
                    {table.imageUrls.length > 0 && (
                      <div className="mb-2 aspect-video w-full overflow-hidden rounded-md">
                        <img
                          src={table.imageUrls[0]}
                          alt={table.name || "Table"}
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <h5 className="text-sm font-medium">
                        {table.name || "Table"}
                      </h5>
                      {table.isCommunal === true && (
                        <span className="flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          <svg
                            className="h-2.5 w-2.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                            />
                          </svg>
                          Communal
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {table.seatCount} seat{table.seatCount > 1 ? "s" : ""}
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      ${table.pricePerHour.toFixed(0)}/hour <span className="text-xs font-normal text-muted-foreground">(total)</span>
                    </p>
                    {nextAvailableTime && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Next available: {nextAvailableTime}
                      </p>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Individual seats section */}
        {hasAnySeats && (
          <div className={availableGroupTables.length > 0 ? "space-y-6" : ""}>
            {availableGroupTables.length > 0 && (
              <h4 className="text-xs font-medium text-muted-foreground">
                Book individual seats
              </h4>
            )}
            <div className="space-y-6">
              {Array.from(seatsByTable.entries()).map(([tableId, { available, unavailable }]) => {
                const table = getTableInfo(tableId)
                if (!table) return null

                // Check if this table is communal (all seats should have same isCommunal flag)
                const isCommunal = Boolean(
                  (available.length > 0 && available[0]?.isCommunal) ||
                  (unavailable.length > 0 && unavailable[0]?.isCommunal)
                )
                const totalSeats = available.length + unavailable.length

                return (
                  <div key={tableId} className="space-y-3">
                    {/* Table header with photo */}
                    <div className="flex items-center gap-3">
                      {table.imageUrls && Array.isArray(table.imageUrls) && table.imageUrls.length > 0 && (
                        <div
                          className="h-12 w-12 overflow-hidden rounded-md cursor-zoom-in"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            openImageModal(table.imageUrls as string[], 0)
                          }}
                        >
                          <img
                            src={table.imageUrls[0]}
                            alt={table.name || "Table"}
                            className="h-full w-full object-cover"
                            draggable={false}
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium">
                            {table.name || "Table"}
                          </h4>
                          {isCommunal && (
                            <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              <svg
                                className="h-3 w-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                />
                              </svg>
                              Communal
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {available.length} available, {unavailable.length} booked
                          {isCommunal && (
                            <span className="block mt-1 text-xs italic">
                              Note: This is a communal space. Other guests may be seated at the same table.
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Seat cards grid */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {/* Available seats */}
                      {available.map((seat) => {
                        const isSelected = selectedSeatId === seat.id

                        return (
                          <SeatCard
                            key={seat.id}
                            seat={{
                              id: seat.id,
                              label: seat.label,
                              position: seat.position,
                              pricePerHour: seat.pricePerHour,
                              tags: seat.tags,
                              imageUrls: seat.imageUrls,
                            }}
                            table={{
                              id: tableId,
                              name: table.name,
                              imageUrls: (table.imageUrls as string[]) || [],
                            }}
                            isAvailable={true}
                            isSelected={isSelected}
                            isCommunal={seat.isCommunal ?? false}
                            nextAvailableAt={null}
                            isFavorited={favoritedSeatIds.has(seat.id)}
                            venueId={venueId}
                            onSelect={() => {
                              setSelectedSeatId(seat.id)
                              setSelectedGroupTableId(null)
                            }}
                          />
                        )
                      })}
                      {/* Unavailable seats */}
                      {unavailable.map((seat) => {
                        return (
                          <SeatCard
                            key={seat.id}
                            seat={{
                              id: seat.id,
                              label: seat.label,
                              position: seat.position,
                              pricePerHour: seat.pricePerHour,
                              tags: seat.tags,
                              imageUrls: seat.imageUrls,
                            }}
                            table={{
                              id: tableId,
                              name: table.name,
                              imageUrls: (table.imageUrls as string[]) || [],
                            }}
                            isAvailable={false}
                            isSelected={false}
                            isCommunal={seat.isCommunal ?? false}
                            nextAvailableAt={seat.nextAvailableAt}
                            isFavorited={favoritedSeatIds.has(seat.id)}
                            venueId={venueId}
                            onSelect={() => {
                              // Unavailable seats can't be selected
                            }}
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </>
    )
  }

  // Helper function to render multi-seat selection
  const renderMultiSeatSelection = () => {
    const hasAnySeatGroups = availableSeatGroups.length > 0
    const hasAnyGroupTables = availableGroupTables.length > 0 || unavailableGroupTables.length > 0
    const hasAnyOptions = hasAnySeatGroups || hasAnyGroupTables

    if (!hasAnyOptions) {
      return (
        <p className="text-sm text-muted-foreground">
          No groups of {seatCount} adjacent seats or tables available for this time. Try a different time, date, or number of seats.
        </p>
      )
    }

    return (
      <div className="space-y-6">
        {/* Group tables section */}
        {hasAnyGroupTables && (
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-muted-foreground">
              Book full table
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Available group tables */}
              {availableGroupTables.map((table) => {
                const isSelected = selectedGroupTableId === table.id
                return (
                  <button
                    key={table.id}
                    type="button"
                    onClick={() => {
                      setSelectedGroupTableId(table.id)
                      setSelectedSeatId(null)
                      setSelectedSeatIds([])
                    }}
                    className={cn(
                      "relative rounded-md border p-4 text-left transition-all",
                      "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                      isSelected
                        ? "border-primary ring-2 ring-primary"
                        : "border-muted hover:border-primary/50"
                    )}
                  >
                    {table.imageUrls.length > 0 && (
                      <div
                        className="mb-2 aspect-video w-full overflow-hidden rounded-md cursor-zoom-in"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          openImageModal(table.imageUrls, 0)
                        }}
                      >
                        <img
                          src={table.imageUrls[0]}
                          alt={table.name || "Table"}
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <h5 className="text-sm font-medium">
                        {table.name || "Table"}
                      </h5>
                      {table.isCommunal === true && (
                        <span className="flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          <svg
                            className="h-2.5 w-2.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                            />
                          </svg>
                          Communal
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {table.seatCount} seat{table.seatCount > 1 ? "s" : ""}
                      {table.isCommunal === true && (
                        <span className="block mt-1 text-[10px] italic">
                          Note: This is a communal space. Other guests may be seated at the same table.
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      ${table.pricePerHour.toFixed(0)}/hour <span className="text-xs font-normal text-muted-foreground">(total)</span>
                    </p>
                    {isSelected && (
                      <div className="absolute right-2 top-2">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <svg
                            className="h-3 w-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      </div>
                    )}
                  </button>
                )
              })}
              {/* Unavailable group tables */}
              {unavailableGroupTables.map((table) => {
                const isSelected = false
                const nextAvailableTime = table.nextAvailableAt
                  ? new Date(table.nextAvailableAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : null
                
                return (
                  <button
                    key={table.id}
                    type="button"
                    disabled
                    className={cn(
                      "relative rounded-md border p-4 text-left opacity-60",
                      "border-muted-foreground/20"
                    )}
                  >
                    {table.imageUrls.length > 0 && (
                      <div className="mb-2 aspect-video w-full overflow-hidden rounded-md">
                        <img
                          src={table.imageUrls[0]}
                          alt={table.name || "Table"}
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <h5 className="text-sm font-medium">
                        {table.name || "Table"}
                      </h5>
                      {table.isCommunal === true && (
                        <span className="flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          <svg
                            className="h-2.5 w-2.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                            />
                          </svg>
                          Communal
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {table.seatCount} seat{table.seatCount > 1 ? "s" : ""}
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      ${table.pricePerHour.toFixed(0)}/hour <span className="text-xs font-normal text-muted-foreground">(total)</span>
                    </p>
                    {nextAvailableTime && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Next available: {nextAvailableTime}
                      </p>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Seat groups section */}
        {hasAnySeatGroups && (
          <div className={hasAnyGroupTables ? "space-y-4" : ""}>
            {hasAnyGroupTables && (
              <h4 className="text-xs font-medium text-muted-foreground">
                Book {seatCount} adjacent seats
              </h4>
            )}
            <div className="space-y-4">
              {availableSeatGroups.map((group, groupIndex) => {
          const table = getTableInfo(group.tableId)
          const allSeatIdsInGroup = group.seats.map(s => s.id)
          const isGroupSelected = selectedSeatIds.length === seatCount && 
            allSeatIdsInGroup.every(id => selectedSeatIds.includes(id))

          return (
            <div key={groupIndex} className="space-y-3">
              {/* Group header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {table && table.imageUrls && Array.isArray(table.imageUrls) && table.imageUrls.length > 0 && (
                    <div
                      className="h-12 w-12 overflow-hidden rounded-md cursor-zoom-in"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        openImageModal(table.imageUrls as string[], 0)
                      }}
                    >
                      <img
                        src={table.imageUrls[0]}
                        alt={table.name || "Table"}
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-medium">
                      {table?.name || "Table"} - {seatCount} seats
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      ${group.totalPricePerHour.toFixed(0)}/hour total
                    </p>
                  </div>
                </div>
                {isGroupSelected && (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}
              </div>

              {/* Seat cards in group */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {group.seats.map((seat) => {
                  const isSeatSelected = selectedSeatIds.includes(seat.id)

                  return (
                    <SeatCard
                      key={seat.id}
                      seat={{
                        id: seat.id,
                        label: seat.label,
                        position: seat.position,
                        pricePerHour: seat.pricePerHour,
                        tags: seat.tags,
                        imageUrls: seat.imageUrls,
                      }}
                      table={{
                        id: group.tableId,
                        name: table?.name || null,
                        imageUrls: (table?.imageUrls as string[]) || [],
                      }}
                      isAvailable={true}
                      isSelected={isSeatSelected}
                      isCommunal={seat.isCommunal ?? false}
                      isFavorited={favoritedSeatIds.has(seat.id)}
                      venueId={venueId}
                      onSelect={() => {
                        setSelectedSeatIds(allSeatIdsInGroup)
                        setSelectedGroupTableId(null)
                        setSelectedSeatId(null)
                      }}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Main render function for seat selection
  const renderSeatSelection = () => {
    if (seatCount === 1) {
      return renderSingleSeatSelection()
    } else {
      return renderMultiSeatSelection()
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Time Selection */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Date
              </label>
              <input
                type="date"
                className="rounded-md border bg-background px-3 py-2 text-sm shadow-sm outline-none ring-0 ring-offset-0 focus:border-primary focus:ring-1 focus:ring-primary"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value)
                  setAvailableSeats([])
                  setUnavailableSeats([])
                  setAvailableSeatGroups([])
                  setAvailableGroupTables([])
                  setUnavailableGroupTables([])
                  setSelectedSeatId(null)
                  setSelectedSeatIds([])
                }}
                min={getLocalDateString()}
                required
              />
            </div>

            <div className="flex flex-col space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Start time
              </label>
              <input
                type="time"
                className="rounded-md border bg-background px-3 py-2 text-sm shadow-sm outline-none ring-0 ring-offset-0 focus:border-primary focus:ring-1 focus:ring-primary"
                value={startTime}
                onChange={(e) => {
                  const newTime = e.target.value
                  setStartTime(newTime)
                  if (date === getLocalDateString() && newTime) {
                    const selectedDateTime = new Date(`${date}T${newTime}`)
                    const now = new Date()
                    if (selectedDateTime < now) {
                      setError("This time is in the past. Please select a current or future time.")
                    } else {
                      setError(null)
                    }
                  } else {
                    setError(null)
                  }
                  setAvailableSeats([])
                  setUnavailableSeats([])
                  setAvailableSeatGroups([])
                  setAvailableGroupTables([])
                  setUnavailableGroupTables([])
                  setSelectedSeatId(null)
                  setSelectedSeatIds([])
                }}
                min={date === getLocalDateString()
                  ? `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`
                  : undefined}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Duration
              </label>
              <select
                className="rounded-md border bg-background px-3 py-2 text-sm shadow-sm outline-none ring-0 ring-offset-0 focus:border-primary focus:ring-1 focus:ring-primary"
                value={durationHours}
                onChange={(e) => {
                  setDurationHours(Number(e.target.value))
                  setAvailableSeats([])
                  setUnavailableSeats([])
                  setAvailableSeatGroups([])
                  setAvailableGroupTables([])
                  setUnavailableGroupTables([])
                  setSelectedSeatId(null)
                  setSelectedSeatIds([])
                }}
              >
                {Array.from({ length: 8 }, (_, i) => i + 1).map((h) => (
                  <option key={h} value={h}>
                    {h} hour{h > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Number of seats
              </label>
              <select
                className="rounded-md border bg-background px-3 py-2 text-sm shadow-sm outline-none ring-0 ring-offset-0 focus:border-primary focus:ring-1 focus:ring-primary"
                value={seatCount}
                onChange={(e) => {
                  setSeatCount(Number(e.target.value))
                  setAvailableSeats([])
                  setUnavailableSeats([])
                  setAvailableSeatGroups([])
                  setAvailableGroupTables([])
                  setUnavailableGroupTables([])
                  setSelectedSeatId(null)
                  setSelectedSeatIds([])
                }}
              >
                {Array.from({ length: 8 }, (_, i) => i + 1).map((s) => (
                  <option key={s} value={s}>
                    {s} seat{s > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleCheckAvailability}
            disabled={!canCheckAvailability}
            loading={isLoadingAvailability}
            className="w-full"
            variant="outline"
          >
            {isLoadingAvailability ? "Checking..." : "Check availability"}
          </Button>
        </div>

        {/* Seat Selection */}
        {hasAvailabilityData && (
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-medium">
              {seatCount === 1 ? "Select a seat" : `Select ${seatCount} seats`}
            </h3>

            {renderSeatSelection()}

            {/* Price estimate */}
            {((seatCount === 1 && (selectedSeatId || selectedGroupTableId)) || 
              (seatCount > 1 && (selectedSeatIds.length > 0 || selectedGroupTableId))) && (
              <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Estimated total
                </span>
                <span className="text-sm font-semibold">
                  ${totalPrice.toFixed(0)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    ({durationHours}h)
                  </span>
                </span>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        {!hasAvailabilityData && (
          <p className="text-xs text-muted-foreground">
            Select a date and time, then click "Check availability" to see available seats.
          </p>
        )}

        {/* Only show reserve button after a selection is made */}
        {hasAvailabilityData && 
         ((seatCount === 1 && (selectedSeatId || selectedGroupTableId)) ||
          (seatCount > 1 && (selectedSeatIds.length > 0 || selectedGroupTableId))) && (
          <>
            <Button
              type="submit"
              className="mt-1 w-full"
              size="lg"
              loading={isSubmitting}
            >
              {isSubmitting ? "Reserving..." : "Reserve seat"}
            </Button>

            <p className="mt-1 text-xs text-muted-foreground">
              You'll only be charged later when we add payments. For now, this
              reserves your seat without payment.
            </p>
          </>
        )}
      </form>

      {ToastComponent}

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
        callbackUrl={pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "")}
      />

      <ImageGalleryModal
        images={imageModalImages}
        initialIndex={imageModalInitialIndex}
        isOpen={isImageOpen}
        onClose={() => setIsImageOpen(false)}
      />
    </>
  )
}
