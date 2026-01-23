"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/toast"
import {
  Calendar,
  Clock,
  MapPin,
  ExternalLink,
  X,
  ChevronRight,
  Navigation,
  Receipt,
} from "lucide-react"
import { cn } from "@/lib/utils"

type TabType = "upcoming" | "past" | "cancelled"

interface Reservation {
  id: string
  startAt: Date
  endAt: Date
  seatId: string | null
  tableId: string | null
  seatCount: number
  status: string
  createdAt: Date
  venue: {
    id: string
    name: string
    address: string | null
    heroImageUrl: string | null
    imageUrls: any
    hourlySeatPrice: number
    googleMapsUrl: string | null
    rulesText: string | null
    tags: string[]
  }
  seat: {
    id: string
    label: string | null
    position: number | null
    pricePerHour: number
    table: {
      name: string | null
    } | null
  } | null
  table: {
    name: string | null
    seatCount: number | null
  } | null
}

interface ReservationsClientProps {
  upcoming: Reservation[]
  past: Reservation[]
  cancelled: Reservation[]
}

export function ReservationsClient({ upcoming, past, cancelled }: ReservationsClientProps) {
  const router = useRouter()
  const { showToast, ToastComponent } = useToast()
  const [activeTab, setActiveTab] = useState<TabType>("upcoming")
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const handleCancel = async (reservationId: string) => {
    setCancellingId(reservationId)
    try {
      const response = await fetch(`/api/reservations/${reservationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      })

      if (!response.ok) {
        throw new Error("Failed to cancel")
      }

      showToast("Reservation cancelled", "success")
      router.refresh()
    } catch (error) {
      showToast("Failed to cancel reservation", "error")
    } finally {
      setCancellingId(null)
      setShowCancelConfirm(false)
    }
  }

  const handleAddToCalendar = (reservation: Reservation) => {
    const start = new Date(reservation.startAt)
    const end = new Date(reservation.endAt)
    const formatICSDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"
    }

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Nook//Reservation//EN",
      "BEGIN:VEVENT",
      `UID:${reservation.id}@nook`,
      `DTSTART:${formatICSDate(start)}`,
      `DTEND:${formatICSDate(end)}`,
      `SUMMARY:Reservation at ${reservation.venue.name}`,
      `DESCRIPTION:Reservation at ${reservation.venue.name}\\n${reservation.venue.address || ""}`,
      `LOCATION:${reservation.venue.address || ""}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n")

    const blob = new Blob([icsContent], { type: "text/calendar" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `reservation-${reservation.id}.ics`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    showToast("Calendar file downloaded", "success")
  }

  const handleGetDirections = (reservation: Reservation) => {
    const address = reservation.venue.address
    const mapsUrl = reservation.venue.googleMapsUrl

    if (mapsUrl) {
      window.open(mapsUrl, "_blank")
    } else if (address) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, "_blank")
    } else {
      showToast("No address available", "error")
    }
  }

  const handleViewReceipt = (reservation: Reservation) => {
    // TODO: Show receipt/transaction info when payments are implemented
    showToast("Receipt feature coming soon", "success")
  }

  const calculatePrice = (reservation: Reservation): number => {
    const start = new Date(reservation.startAt)
    const end = new Date(reservation.endAt)
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)

    // If multiple seats booked, use venue price * seat count
    if (reservation.seatCount > 1) {
      return reservation.venue.hourlySeatPrice * hours * reservation.seatCount
    }
    // For single seat bookings, use seat price if available
    if (reservation.seatId && reservation.seat) {
      return reservation.seat.pricePerHour * hours
    }
    // Fallback to venue price * seat count
    return reservation.venue.hourlySeatPrice * hours * reservation.seatCount
  }

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(date)
  }

  const formatTime = (date: Date): string => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(date)
  }

  const formatDateTimeRange = (start: Date, end: Date): string => {
    const isToday = new Date().toDateString() === start.toDateString()
    if (isToday) {
      return `Today · ${formatTime(start)} – ${formatTime(end)}`
    }
    return `${formatDate(start)} · ${formatTime(start)} – ${formatTime(end)}`
  }

  const getSeatInfo = (reservation: Reservation): string => {
    // For group table bookings (seatId is null, tableId exists)
    // Use table's actual seat count as the source of truth
    if (!reservation.seatId && reservation.tableId && reservation.table?.seatCount) {
      const actualSeatCount = reservation.table.seatCount
      const tableName = reservation.table.name
      return tableName ? `Table ${tableName} for ${actualSeatCount}` : `Table for ${actualSeatCount}`
    }
    
    // If multiple seats booked, always show seat count
    if (reservation.seatCount > 1) {
      return `${reservation.seatCount} seat${reservation.seatCount > 1 ? "s" : ""}`
    }
    // For single seat bookings, show seat details if available
    if (reservation.seatId && reservation.seat) {
      const seatLabel = reservation.seat.label || `Seat ${reservation.seat.position || ""}`
      const tableName = reservation.seat.table?.name || "Table"
      return `${seatLabel} at ${tableName}`
    }
    // Fallback to seat count
    return `${reservation.seatCount} seat${reservation.seatCount > 1 ? "s" : ""}`
  }

  const getCurrentReservations = () => {
    switch (activeTab) {
      case "upcoming":
        return upcoming
      case "past":
        return past
      case "cancelled":
        return cancelled
    }
  }

  const heroReservation = activeTab === "upcoming" && upcoming.length > 0 ? upcoming[0] : null
  const otherUpcoming = activeTab === "upcoming" && upcoming.length > 1 ? upcoming.slice(1) : []
  const currentReservations = getCurrentReservations()

  return (
    <div className="min-h-screen bg-background">
      {ToastComponent}

      <div className="container mx-auto px-4 pt-2 pb-6">
        {/* Tabs */}
        <div className="mb-3 flex gap-2 border-b -mx-4 px-4">
          <button
            onClick={() => setActiveTab("upcoming")}
            className={cn(
              "px-2 py-2 text-sm font-medium transition-colors",
              activeTab === "upcoming"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Upcoming {upcoming.length > 0 && `(${upcoming.length})`}
          </button>
          <button
            onClick={() => setActiveTab("past")}
            className={cn(
              "px-2 py-2 text-sm font-medium transition-colors",
              activeTab === "past"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Past {past.length > 0 && `(${past.length})`}
          </button>
          <button
            onClick={() => setActiveTab("cancelled")}
            className={cn(
              "px-2 py-2 text-sm font-medium transition-colors",
              activeTab === "cancelled"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Cancelled {cancelled.length > 0 && `(${cancelled.length})`}
          </button>
        </div>

        {/* Upcoming View */}
        {activeTab === "upcoming" && (
          <>
            {upcoming.length === 0 ? (
              <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
                <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
                <h2 className="mb-2 text-xl font-semibold">No upcoming reservations</h2>
                <p className="mb-6 text-sm text-muted-foreground">
                  When you reserve seats, they&apos;ll appear here.
                </p>
                <Button asChild>
                  <Link href="/">Explore workspaces</Link>
                </Button>
              </div>
            ) : (
              <>
                {/* Hero Card */}
                {heroReservation && (
                  <HeroReservationCard
                    reservation={heroReservation}
                    onViewDetails={() => router.push(`/reservations/${heroReservation.id}`)}
                    onAddToCalendar={() => handleAddToCalendar(heroReservation)}
                    onCancel={() => setShowCancelConfirm(true)}
                    onGetDirections={() => handleGetDirections(heroReservation)}
                    onViewReceipt={() => handleViewReceipt(heroReservation)}
                    calculatePrice={calculatePrice}
                    formatDateTimeRange={formatDateTimeRange}
                    getSeatInfo={getSeatInfo}
                  />
                )}

                {/* Other Upcoming List */}
                {otherUpcoming.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <h2 className="text-sm font-medium text-muted-foreground">Upcoming</h2>
                    {otherUpcoming.map((reservation) => (
                      <UpcomingListItem
                        key={reservation.id}
                        reservation={reservation}
                        onViewDetails={() => router.push(`/reservations/${reservation.id}`)}
                        formatDateTimeRange={formatDateTimeRange}
                        getSeatInfo={getSeatInfo}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Past View */}
        {activeTab === "past" && (
          <>
            {past.length === 0 ? (
              <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
                <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
                <h2 className="mb-2 text-xl font-semibold">No past reservations</h2>
                <p className="text-sm text-muted-foreground">
                  Your past reservations will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {past.map((reservation) => (
                  <PastReservationCard
                    key={reservation.id}
                    reservation={reservation}
                    onViewDetails={() => router.push(`/reservations/${reservation.id}`)}
                    calculatePrice={calculatePrice}
                    formatDateTimeRange={formatDateTimeRange}
                    getSeatInfo={getSeatInfo}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Cancelled View */}
        {activeTab === "cancelled" && (
          <>
            {cancelled.length === 0 ? (
              <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
                <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
                <h2 className="mb-2 text-xl font-semibold">No cancelled reservations</h2>
                <p className="text-sm text-muted-foreground">
                  Your cancelled reservations will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {cancelled.map((reservation) => (
                  <CancelledReservationCard
                    key={reservation.id}
                    reservation={reservation}
                    onViewDetails={() => router.push(`/reservations/${reservation.id}`)}
                    calculatePrice={calculatePrice}
                    formatDateTimeRange={formatDateTimeRange}
                    getSeatInfo={getSeatInfo}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel reservation?</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this reservation? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelConfirm(false)}>
              Keep reservation
            </Button>
            <Button
              variant="destructive"
              onClick={() => heroReservation && handleCancel(heroReservation.id)}
              disabled={cancellingId !== null}
            >
              {cancellingId ? "Cancelling..." : "Cancel reservation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Hero Reservation Card Component
function HeroReservationCard({
  reservation,
  onViewDetails,
  onAddToCalendar,
  onCancel,
  onGetDirections,
  calculatePrice,
  formatDateTimeRange,
  getSeatInfo,
  onViewReceipt,
}: {
  reservation: Reservation
  onViewDetails: () => void
  onAddToCalendar: () => void
  onCancel: () => void
  onGetDirections: () => void
  calculatePrice: (r: Reservation) => number
  formatDateTimeRange: (start: Date, end: Date) => string
  getSeatInfo: (r: Reservation) => string
  onViewReceipt?: () => void
}) {
  const isPast = new Date(reservation.endAt) < new Date()
  const imageUrl =
    reservation.venue.heroImageUrl ||
    (Array.isArray(reservation.venue.imageUrls) && reservation.venue.imageUrls.length > 0
      ? reservation.venue.imageUrls[0]
      : null)

  return (
    <Card className="overflow-hidden">
      {imageUrl && (
        <div className="relative h-64 sm:h-80 w-full overflow-hidden bg-muted">
          <img src={imageUrl} alt={reservation.venue.name} className="h-full w-full object-cover" />
        </div>
      )}
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Venue Name */}
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{reservation.venue.name}</h2>
            {reservation.venue.address && (
              <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{reservation.venue.address}</span>
              </div>
            )}
          </div>

          {/* Date & Time */}
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              {formatDateTimeRange(new Date(reservation.startAt), new Date(reservation.endAt))}
            </span>
          </div>

          {/* Seat Info */}
          <div className="text-sm text-muted-foreground">
            {getSeatInfo(reservation)}
          </div>

          {/* Price Estimate */}
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Estimated</span>
              <span className="text-lg font-semibold">${calculatePrice(reservation).toFixed(0)}</span>
            </div>
          </div>

          {/* Rules Snippet */}
          {reservation.venue.rulesText && (
            <div className="text-xs text-muted-foreground line-clamp-2">
              {reservation.venue.rulesText}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={onViewDetails} className="w-full" size="lg">
              View details
            </Button>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm" onClick={onAddToCalendar}>
                <Calendar className="mr-1.5 h-3.5 w-3.5" />
                Calendar
              </Button>
              <Button variant="outline" size="sm" onClick={onGetDirections}>
                <Navigation className="mr-1.5 h-3.5 w-3.5" />
                Directions
              </Button>
              {isPast && onViewReceipt ? (
                <Button variant="outline" size="sm" onClick={onViewReceipt}>
                  <Receipt className="mr-1.5 h-3.5 w-3.5" />
                  Receipt
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={onCancel}>
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Upcoming List Item Component
function UpcomingListItem({
  reservation,
  onViewDetails,
  formatDateTimeRange,
  getSeatInfo,
}: {
  reservation: Reservation
  onViewDetails: () => void
  formatDateTimeRange: (start: Date, end: Date) => string
  getSeatInfo: (r: Reservation) => string
}) {
  return (
    <Card className="cursor-pointer transition-colors hover:bg-accent" onClick={onViewDetails}>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{reservation.venue.name}</h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatDateTimeRange(new Date(reservation.startAt), new Date(reservation.endAt))}</span>
          </div>
          <div className="text-xs text-muted-foreground">{getSeatInfo(reservation)}</div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </CardContent>
    </Card>
  )
}

// Past Reservation Card Component
function PastReservationCard({
  reservation,
  onViewDetails,
  calculatePrice,
  formatDateTimeRange,
  getSeatInfo,
}: {
  reservation: Reservation
  onViewDetails: () => void
  calculatePrice: (r: Reservation) => number
  formatDateTimeRange: (start: Date, end: Date) => string
  getSeatInfo: (r: Reservation) => string
}) {
  return (
    <Card className="cursor-pointer transition-colors hover:bg-accent" onClick={onViewDetails}>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{reservation.venue.name}</h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatDateTimeRange(new Date(reservation.startAt), new Date(reservation.endAt))}</span>
          </div>
          <div className="text-xs text-muted-foreground">{getSeatInfo(reservation)}</div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">
            ${calculatePrice(reservation).toFixed(0)}
          </span>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  )
}

// Cancelled Reservation Card Component
function CancelledReservationCard({
  reservation,
  onViewDetails,
  calculatePrice,
  formatDateTimeRange,
  getSeatInfo,
}: {
  reservation: Reservation
  onViewDetails: () => void
  calculatePrice: (r: Reservation) => number
  formatDateTimeRange: (start: Date, end: Date) => string
  getSeatInfo: (r: Reservation) => string
}) {
  return (
    <Card className="cursor-pointer transition-colors hover:bg-accent opacity-75" onClick={onViewDetails}>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{reservation.venue.name}</h3>
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
              Cancelled
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatDateTimeRange(new Date(reservation.startAt), new Date(reservation.endAt))}</span>
          </div>
          <div className="text-xs text-muted-foreground">{getSeatInfo(reservation)}</div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </CardContent>
    </Card>
  )
}
