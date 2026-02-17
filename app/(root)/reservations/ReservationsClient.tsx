"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
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
import { cn, isBlobSupported } from "@/lib/utils"

type TabType = "upcoming" | "past" | "cancelled"

interface Reservation {
  id: string
  userId: string | null
  startAt: Date | string
  endAt: Date | string
  seatId: string | null
  tableId: string | null
  seatCount: number
  status: string
  createdAt: Date | string
  venue: {
    id: string
    name: string
    address: string | null
    heroImageUrl: string | null
    imageUrls: string[] | null | any
    hourlySeatPrice: number
    googleMapsUrl?: string | null
    rulesText?: string | null
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
    id: string
    name: string | null
    seatCount: number | null
    tablePricePerHour: number | null
    seats?: { id: string }[]
  } | null
  payment?: {
    id: string
    status: string
    amount: number
    currency: string
    amountRefunded: number
    refundRequests: Array<{
      id: string
      status: string
      requestedAmount: number
      approvedAmount: number | null
    }>
  } | null
}

interface ReservationsClientProps {
  initialUpcoming: Reservation[]
  counts: {
    upcoming: number
    past: number
    cancelled: number
  }
}

export function ReservationsClient({ initialUpcoming, counts }: ReservationsClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast, ToastComponent } = useToast()
  const [activeTab, setActiveTab] = useState<TabType>("upcoming")
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  // On-demand fetching for past and cancelled
  const { data: pastReservations, isLoading: isLoadingPast } = useQuery<Reservation[]>({
    queryKey: ["reservations", "past"],
    queryFn: async () => {
      const resp = await fetch("/api/reservations?tab=past")
      if (!resp.ok) throw new Error("Failed to fetch past reservations")
      return resp.json()
    },
    enabled: activeTab === "past",
    staleTime: 60 * 1000,
  })

  const { data: cancelledReservations, isLoading: isLoadingCancelled } = useQuery<Reservation[]>({
    queryKey: ["reservations", "cancelled"],
    queryFn: async () => {
      const resp = await fetch("/api/reservations?tab=cancelled")
      if (!resp.ok) throw new Error("Failed to fetch cancelled reservations")
      return resp.json()
    },
    enabled: activeTab === "cancelled",
    staleTime: 60 * 1000,
  })

  const upcoming = initialUpcoming

  // When returning from detail page after cancel, refresh list and clean URL
  useEffect(() => {
    if (searchParams?.get("refresh") === "1") {
      router.refresh()
      router.replace("/reservations", { scroll: false })
    }
  }, [searchParams, router])

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

      await response.json().catch(() => null)
      showToast("Reservation cancelled", "success")
      // Refresh server data so the list updates (cancel from list page)
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
      "PRODID:-//Nooc//Reservation//EN",
      "BEGIN:VEVENT",
      `UID:${reservation.id}@nooc`,
      `DTSTART:${formatICSDate(start)}`,
      `DTEND:${formatICSDate(end)}`,
      `SUMMARY:Reservation at ${reservation.venue.name}`,
      `DESCRIPTION:Reservation at ${reservation.venue.name}\\n${reservation.venue.address || ""}`,
      `LOCATION:${reservation.venue.address || ""}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n")

    if (!isBlobSupported()) {
      showToast("Calendar download is not supported in this browser", "error")
      return
    }
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

    // GROUP table booking: tableId exists and seatId is null
    // Use table's tablePricePerHour (total price for the table, not per-seat)
    if (reservation.tableId && !reservation.seatId && reservation.table?.tablePricePerHour) {
      return reservation.table.tablePricePerHour * hours
    }

    // For single seat bookings, use seat price if available
    if (reservation.seatId && reservation.seat) {
      return reservation.seat.pricePerHour * hours
    }

    // Fallback: multiple seats or individual booking without seat data
    // Use venue price * seat count
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
    // Use table's seats.length when available, else fall back to seatCount column
    if (!reservation.seatId && reservation.tableId && reservation.table) {
      const actualSeatCount =
        reservation.table.seats?.length ??
        reservation.table.seatCount ??
        1
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
        return pastReservations || []
      case "cancelled":
        return cancelledReservations || []
    }
  }

  const isLoading = (activeTab === "past" && isLoadingPast) || (activeTab === "cancelled" && isLoadingCancelled)
  const heroReservation = activeTab === "upcoming" && upcoming.length > 0 ? upcoming[0] : null
  const otherUpcoming = activeTab === "upcoming" && upcoming.length > 1 ? upcoming.slice(1) : []
  const currentReservations = getCurrentReservations()

  return (
    <div className="min-h-screen bg-background">
      {ToastComponent}

      <div className="container mx-auto px-4 pt-4 pb-10 max-w-2xl">
        <h1 className="text-4xl font-black tracking-tight mb-8 px-1">My Reservations</h1>

        {/* Tabs */}
        <div className="mb-8 flex p-1 gap-1 bg-primary/5 rounded-2xl">
          {(["upcoming", "past", "cancelled"] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all duration-300 rounded-xl flex items-center justify-center gap-2",
                activeTab === tab
                  ? "bg-white text-primary shadow-sm"
                  : "text-muted-foreground/60 hover:text-primary/70"
              )}
            >
              {tab}
              {counts[tab] > 0 && (
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full",
                  activeTab === tab ? "bg-primary/10 text-primary" : "bg-muted-foreground/10 text-muted-foreground/60"
                )}>
                  {counts[tab]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Upcoming View */}
        {activeTab === "upcoming" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {upcoming.length === 0 ? (
              <div className="flex min-h-[400px] flex-col items-center justify-center rounded-[2.5rem] border border-dashed border-primary/20 p-12 text-center bg-primary/[0.02]">
                <div className="h-20 w-20 rounded-full bg-primary/5 flex items-center justify-center mb-6">
                  <Calendar className="h-10 w-10 text-primary/30" />
                </div>
                <h2 className="mb-2 text-xl font-bold">Your schedule is empty</h2>
                <p className="mb-8 text-sm text-muted-foreground/70 max-w-[220px]">
                  When you reserve your next spot, it will show up right here.
                </p>
                <Button asChild className="rounded-2xl font-black px-8">
                  <Link href="/">Book a Workspace</Link>
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
                  <div className="space-y-4">
                    <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 px-2">Next in line</h2>
                    <div className="space-y-3">
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
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Past and Cancelled View */}
        {(activeTab === "past" || activeTab === "cancelled") && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 rounded-[2rem] bg-primary/[0.02] animate-pulse" />
                ))}
              </div>
            ) : currentReservations.length === 0 ? (
              <div className="flex min-h-[400px] flex-col items-center justify-center rounded-[2.5rem] border border-dashed border-primary/20 p-12 text-center bg-primary/[0.02]">
                <div className="h-20 w-20 rounded-full bg-primary/5 flex items-center justify-center mb-6">
                  <Calendar className="h-10 w-10 text-primary/30" />
                </div>
                <h2 className="mb-2 text-xl font-bold">
                  {activeTab === "past" ? "No history yet" : "Clean slate"}
                </h2>
                <p className="text-sm text-muted-foreground/70">
                  Your {activeTab} reservations will appear here.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {currentReservations.map((reservation) => (
                  activeTab === "past" ? (
                    <PastReservationCard
                      key={reservation.id}
                      reservation={reservation}
                      onViewDetails={() => router.push(`/reservations/${reservation.id}`)}
                      calculatePrice={calculatePrice}
                      formatDateTimeRange={formatDateTimeRange}
                      getSeatInfo={getSeatInfo}
                    />
                  ) : (
                    <CancelledReservationCard
                      key={reservation.id}
                      reservation={reservation}
                      onViewDetails={() => router.push(`/reservations/${reservation.id}`)}
                      calculatePrice={calculatePrice}
                      formatDateTimeRange={formatDateTimeRange}
                      getSeatInfo={getSeatInfo}
                    />
                  )
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <DialogContent className="rounded-[2.5rem] p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight">Change of plans?</DialogTitle>
            <DialogDescription className="text-sm font-medium leading-relaxed text-muted-foreground pt-2">
              Are you sure you want to cancel this reservation? This action cannot be undone.
              Refunds are handled through our standard request flow.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-6">
            <Button
              variant="destructive"
              onClick={() => heroReservation && handleCancel(heroReservation.id)}
              disabled={cancellingId !== null}
              className="rounded-2xl font-black py-6 shadow-md shadow-red-500/10"
            >
              {cancellingId ? "Cancelling..." : "Yes, cancel reservation"}
            </Button>
            <Button variant="ghost" onClick={() => setShowCancelConfirm(false)} className="rounded-2xl font-bold py-6 text-muted-foreground">
              Keep my booking
            </Button>
          </div>
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
    <Card className="overflow-hidden border-none shadow-xl rounded-[2.5rem] bg-white group">
      {imageUrl && (
        <div className="relative h-72 sm:h-96 w-full overflow-hidden bg-muted">
          <img src={imageUrl} alt={reservation.venue.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-6 left-6 right-6">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 mb-2">
              <Clock className="h-3 w-3 text-white" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white">
                {formatDateTimeRange(new Date(reservation.startAt), new Date(reservation.endAt))}
              </span>
            </div>
            <h2 className="text-3xl font-black tracking-tight text-white">{reservation.venue.name}</h2>
          </div>
        </div>
      )}
      <CardContent className="p-8">
        <div className="space-y-6">
          <div className="flex flex-col gap-1">
            {reservation.venue.address && (
              <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground/60">
                <MapPin className="h-4 w-4" />
                <span className="truncate">{reservation.venue.address}</span>
              </div>
            )}
            <div className="text-sm font-bold text-primary bg-primary/5 px-3 py-1 rounded-full w-fit mt-2">
              {getSeatInfo(reservation)}
            </div>
          </div>

          <div className="flex items-center justify-between p-6 bg-primary/[0.02] rounded-[2rem]">
            <div className="space-y-0.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Total Estimate</p>
              <p className="text-3xl font-black tracking-tighter text-primary">${calculatePrice(reservation).toFixed(0)}</p>
            </div>
            <Button onClick={onViewDetails} className="rounded-2xl font-black px-8 h-12 shadow-md shadow-primary/10">
              Details
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Button variant="outline" size="lg" onClick={onAddToCalendar} className="rounded-2xl border-none bg-primary/5 hover:bg-primary/10 text-primary font-bold transition-all duration-300">
              <Calendar size={18} className="mr-2 opacity-50" />
              Sync
            </Button>
            <Button variant="outline" size="lg" onClick={onGetDirections} className="rounded-2xl border-none bg-primary/5 hover:bg-primary/10 text-primary font-bold transition-all duration-300">
              <Navigation size={18} className="mr-2 opacity-50" />
              Map
            </Button>
            {isPast && onViewReceipt ? (
              <Button variant="outline" size="lg" onClick={onViewReceipt} className="rounded-2xl border-none bg-primary/5 hover:bg-primary/10 text-primary font-bold transition-all duration-300">
                <Receipt size={18} className="mr-2 opacity-50" />
                Receipt
              </Button>
            ) : (
              <Button variant="outline" size="lg" onClick={onCancel} className="rounded-2xl border-none bg-red-50 hover:bg-red-100 text-red-600 font-bold transition-all duration-300">
                <X size={18} className="mr-2 opacity-50" />
                Cancel
              </Button>
            )}
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
    <div
      className="group relative flex w-full gap-4 rounded-[2rem] border border-white bg-white/40 p-4 shadow-sm transition-all duration-300 hover:premium-shadow hover:bg-white/80 active:scale-[0.98] cursor-pointer"
      onClick={onViewDetails}
    >
      <div className="flex-1 space-y-1 py-1">
        <h3 className="font-black text-foreground/90 group-hover:text-primary transition-colors">{reservation.venue.name}</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
            <Clock className="h-3 w-3" />
            <span>{formatDateTimeRange(new Date(reservation.startAt), new Date(reservation.endAt))}</span>
          </div>
          <span className="text-[10px] font-black text-primary/40 uppercase tracking-widest bg-primary/5 px-2 py-0.5 rounded-full">
            {getSeatInfo(reservation)}
          </span>
        </div>
      </div>
      <div className="flex items-center pr-2">
        <ChevronRight size={20} className="text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
      </div>
    </div>
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
    <div
      className="group flex items-center justify-between p-5 rounded-[2rem] border border-white bg-white/40 shadow-sm transition-all duration-300 hover:bg-white/80 hover:premium-shadow active:scale-[0.99] cursor-pointer"
      onClick={onViewDetails}
    >
      <div className="flex-1 space-y-1">
        <h3 className="font-bold text-foreground/80">{reservation.venue.name}</h3>
        <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">
          <Clock className="h-3 w-3" />
          <span>{formatDateTimeRange(new Date(reservation.startAt), new Date(reservation.endAt))}</span>
        </div>
        <div className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-tighter">{getSeatInfo(reservation)}</div>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-lg font-black tracking-tight text-foreground/60">
          ${calculatePrice(reservation).toFixed(0)}
        </span>
        <ChevronRight size={18} className="text-muted-foreground/20 group-hover:text-foreground/40 transition-colors" />
      </div>
    </div>
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
    <div
      className="group flex items-center justify-between p-5 rounded-[2rem] border border-white bg-white/20 shadow-sm grayscale opacity-60 transition-all duration-300 hover:grayscale-0 hover:opacity-100 hover:bg-white/40 active:scale-[0.99] cursor-pointer"
      onClick={onViewDetails}
    >
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-foreground/80">{reservation.venue.name}</h3>
          <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-red-600">
            Cancelled
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">
          <Clock className="h-3 w-3" />
          <span>{formatDateTimeRange(new Date(reservation.startAt), new Date(reservation.endAt))}</span>
        </div>
        <div className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-tighter">{getSeatInfo(reservation)}</div>
      </div>
      <ChevronRight size={18} className="text-muted-foreground/20" />
    </div>
  )
}
