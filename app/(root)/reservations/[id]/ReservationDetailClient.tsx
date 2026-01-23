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
  Navigation,
  X,
  ArrowLeft,
  Receipt,
} from "lucide-react"

interface ReservationDetailClientProps {
  reservation: {
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
}

export function ReservationDetailClient({ reservation }: ReservationDetailClientProps) {
  const router = useRouter()
  const { showToast, ToastComponent } = useToast()
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const handleCancel = async () => {
    setCancelling(true)
    try {
      const response = await fetch(`/api/reservations/${reservation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      })

      if (!response.ok) {
        throw new Error("Failed to cancel")
      }

      showToast("Reservation cancelled", "success")
      router.push("/reservations")
    } catch (error) {
      showToast("Failed to cancel reservation", "error")
    } finally {
      setCancelling(false)
      setShowCancelConfirm(false)
    }
  }

  const handleAddToCalendar = () => {
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

  const handleGetDirections = () => {
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

  const calculatePrice = (): number => {
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
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date)
  }

  const formatTime = (date: Date): string => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(date)
  }

  const getSeatInfo = (): string => {
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

  const imageUrl =
    reservation.venue.heroImageUrl ||
    (Array.isArray(reservation.venue.imageUrls) && reservation.venue.imageUrls.length > 0
      ? reservation.venue.imageUrls[0]
      : null)

  const isCancelled = reservation.status === "cancelled"
  const isPast = new Date(reservation.endAt) < new Date()

  const handleViewReceipt = () => {
    // TODO: Show receipt/transaction info when payments are implemented
    showToast("Receipt feature coming soon", "success")
  }

  return (
    <div className="min-h-screen bg-background">
      {ToastComponent}

      <div className="container mx-auto px-4 py-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/reservations">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to reservations
          </Link>
        </Button>

        {isCancelled && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <X className="h-5 w-5 text-red-700" />
              <span className="font-medium text-red-900">This reservation has been cancelled</span>
            </div>
          </div>
        )}

        <Card className="overflow-hidden">
          {imageUrl && (
            <div className="relative h-64 w-full overflow-hidden bg-muted">
              <img src={imageUrl} alt={reservation.venue.name} className="h-full w-full object-cover" />
            </div>
          )}
          <CardContent className="p-6">
            <div className="space-y-6">
              {/* Venue Name */}
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">{reservation.venue.name}</h1>
                {reservation.venue.address && (
                  <div className="mt-2 flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{reservation.venue.address}</span>
                  </div>
                )}
              </div>

              {/* Date & Time */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{formatDate(new Date(reservation.startAt))}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {formatTime(new Date(reservation.startAt))} – {formatTime(new Date(reservation.endAt))}
                  </span>
                </div>
              </div>

              {/* Seat Info */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Seat details</h3>
                <p className="text-sm text-muted-foreground">{getSeatInfo()}</p>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Status</h3>
                <span
                  className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${
                    isCancelled
                      ? "bg-red-50 text-red-700"
                      : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {isCancelled ? "Cancelled" : "Active"}
                </span>
              </div>

              {/* Price Breakdown */}
              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-3 text-sm font-medium">Price breakdown</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {reservation.seatCount > 1
                        ? `${reservation.seatCount} seats (${formatTime(new Date(reservation.startAt))} – ${formatTime(new Date(reservation.endAt))})`
                        : reservation.seatId && reservation.seat
                          ? `Seat (${formatTime(new Date(reservation.startAt))} – ${formatTime(new Date(reservation.endAt))})`
                          : `${reservation.seatCount} seat${reservation.seatCount > 1 ? "s" : ""} (${formatTime(new Date(reservation.startAt))} – ${formatTime(new Date(reservation.endAt))})`}
                    </span>
                    <span className="font-medium">
                      {reservation.seatCount > 1
                        ? `${reservation.venue.hourlySeatPrice.toFixed(0)}/hour × ${reservation.seatCount}`
                        : reservation.seatId && reservation.seat
                          ? `${reservation.seat.pricePerHour.toFixed(0)}/hour`
                          : `${reservation.venue.hourlySeatPrice.toFixed(0)}/hour`}
                    </span>
                  </div>
                  <div className="border-t pt-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Estimated total</span>
                      <span className="text-lg font-semibold">${calculatePrice().toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rules */}
              {reservation.venue.rulesText && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Venue rules</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {reservation.venue.rulesText}
                  </p>
                </div>
              )}

              {/* Actions */}
              {!isCancelled && (
                <div className="flex flex-col gap-2 pt-4">
                  <Button 
                    asChild 
                    variant="outline" 
                    className="w-full"
                  >
                    <Link href={`/venue/${reservation.venue.id}?returnTo=/reservations/${reservation.id}`}>
                      <MapPin className="mr-2 h-4 w-4" />
                      View Venue
                    </Link>
                  </Button>
                  <Button onClick={handleAddToCalendar} variant="outline" className="w-full">
                    <Calendar className="mr-2 h-4 w-4" />
                    Add to calendar
                  </Button>
                  <Button onClick={handleGetDirections} variant="outline" className="w-full">
                    <Navigation className="mr-2 h-4 w-4" />
                    Get directions
                  </Button>
                  {isPast ? (
                    <Button onClick={handleViewReceipt} variant="outline" className="w-full">
                      <Receipt className="mr-2 h-4 w-4" />
                      View receipt
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setShowCancelConfirm(true)}
                      variant="destructive"
                      className="w-full"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancel reservation
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
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
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? "Cancelling..." : "Cancel reservation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
