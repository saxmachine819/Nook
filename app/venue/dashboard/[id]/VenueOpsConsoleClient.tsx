"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  Settings,
  ExternalLink,
  Clock,
  User,
  RefreshCw,
  Ban,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  isReservationActive,
  isSeatBlocked,
  getReservationStatus,
  formatTimeRange,
  formatDate,
  isToday,
  groupReservationsByTime,
  getReservationSeatInfo,
  getBookerDisplay,
  getSeatLabel,
  type Reservation,
  type SeatBlock,
} from "@/lib/venue-ops"

interface VenueOpsConsoleClientProps {
  venue: {
    id: string
    name: string
    tables: Array<{
      id: string
      name: string | null
      seats: Array<{
        id: string
        label: string | null
        position: number | null
        pricePerHour: number
      }>
    }>
  }
  reservations: Array<{
    id: string
    startAt: Date | string
    endAt: Date | string
    status: string
    seatId: string | null
    tableId: string | null
    seatCount: number
    userId: string | null
    user: { email: string | null } | null
    seat: {
      label: string | null
      table: { name: string | null } | null
    } | null
    table: { name: string | null } | null
  }>
  seatBlocks: Array<{
    id: string
    seatId: string | null
    startAt: Date | string
    endAt: Date | string
    reason: string | null
  }>
  now: string
}

type TabMode = "upcoming" | "past" | "cancelled"

export function VenueOpsConsoleClient({
  venue,
  reservations: initialReservations,
  seatBlocks: initialSeatBlocks,
  now: initialNow,
}: VenueOpsConsoleClientProps) {
  const router = useRouter()
  const { showToast, ToastComponent } = useToast()

  const [reservations, setReservations] = useState(initialReservations)
  const [seatBlocks, setSeatBlocks] = useState(initialSeatBlocks)
  const [currentTime, setCurrentTime] = useState(new Date(initialNow))
  const [activeTab, setActiveTab] = useState<TabMode>("upcoming")
  const [searchQuery, setSearchQuery] = useState("")
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)
  const [blockingSeat, setBlockingSeat] = useState<{ seatId: string | null; tableName: string } | null>(null)
  const [selectedSeat, setSelectedSeat] = useState<{ seatId: string; tableName: string } | null>(null)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isTabVisible, setIsTabVisible] = useState(true)
  const refreshInFlightRef = useRef(false)
  
  // Refs for intersection observer (sticky header)
  const nowSectionRef = useRef<HTMLDivElement>(null)
  const todaySectionRef = useRef<HTMLDivElement>(null)
  const weekSectionRef = useRef<HTMLDivElement>(null)
  
  const [visibleSection, setVisibleSection] = useState<"Now" | "Today" | "This week">("Now")

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [])

  // Track tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden)
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [])

  // Categorize reservations into Upcoming, Past, and Cancelled
  const categorizedReservations = useMemo(() => {
    const now = currentTime
    const upcoming: Reservation[] = []
    const past: Reservation[] = []
    const cancelled: Reservation[] = []

    for (const reservation of reservations) {
      if (reservation.status === "cancelled") {
        cancelled.push(reservation)
      } else {
        const end = typeof reservation.endAt === "string" ? new Date(reservation.endAt) : reservation.endAt
        if (end >= now) {
          upcoming.push(reservation)
        } else {
          past.push(reservation)
        }
      }
    }

    // Sort upcoming by startAt ascending (nearest first)
    upcoming.sort((a, b) => {
      const startA = typeof a.startAt === "string" ? new Date(a.startAt) : a.startAt
      const startB = typeof b.startAt === "string" ? new Date(b.startAt) : b.startAt
      return startA.getTime() - startB.getTime()
    })

    // Sort past by startAt descending (most recent first)
    past.sort((a, b) => {
      const startA = typeof a.startAt === "string" ? new Date(a.startAt) : a.startAt
      const startB = typeof b.startAt === "string" ? new Date(b.startAt) : b.startAt
      return startB.getTime() - startA.getTime()
    })

    // Sort cancelled by startAt descending (most recent first)
    cancelled.sort((a, b) => {
      const startA = typeof a.startAt === "string" ? new Date(a.startAt) : a.startAt
      const startB = typeof b.startAt === "string" ? new Date(b.startAt) : b.startAt
      return startB.getTime() - startA.getTime()
    })

    return { upcoming, past, cancelled }
  }, [reservations, currentTime])

  // Group upcoming reservations into Now, Today, This week
  const upcomingSections = useMemo(() => {
    const now = currentTime
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const nextWeek = new Date(today)
    nextWeek.setDate(nextWeek.getDate() + 7)

    const nowSection: Reservation[] = []
    const todaySection: Reservation[] = []
    const weekSection: Reservation[] = []

    for (const reservation of categorizedReservations.upcoming) {
      const start = typeof reservation.startAt === "string" ? new Date(reservation.startAt) : reservation.startAt
      const end = typeof reservation.endAt === "string" ? new Date(reservation.endAt) : reservation.endAt

      // "Now" - currently active
      if (start <= now && now < end) {
        nowSection.push(reservation)
        continue
      }

      // "Today" - starts today but not currently active
      if (start >= today && start < tomorrow) {
        todaySection.push(reservation)
        continue
      }

      // "This week" - within next 7 days but not today
      if (start >= tomorrow && start < nextWeek) {
        weekSection.push(reservation)
      }
    }

    return { now: nowSection, today: todaySection, week: weekSection }
  }, [categorizedReservations.upcoming, currentTime])

  // Determine initial visible section and update when sections change
  useEffect(() => {
    if (upcomingSections.now.length > 0) {
      setVisibleSection("Now")
    } else if (upcomingSections.today.length > 0) {
      setVisibleSection("Today")
    } else if (upcomingSections.week.length > 0) {
      setVisibleSection("This week")
    }
  }, [upcomingSections.now.length, upcomingSections.today.length, upcomingSections.week.length])

  // Intersection Observer for sticky header (only for upcoming tab)
  useEffect(() => {
    if (activeTab !== "upcoming") return

    const observers: IntersectionObserver[] = []
    const refs = [nowSectionRef, todaySectionRef, weekSectionRef]
    const sectionNames: ("Now" | "Today" | "This week")[] = ["Now", "Today", "This week"]

    refs.forEach((ref, index) => {
      if (!ref.current) return

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setVisibleSection(sectionNames[index])
            }
          })
        },
        { threshold: 0.1, rootMargin: "-80px 0px 0px 0px" }
      )

      observer.observe(ref.current)
      observers.push(observer)
    })

    return () => {
      observers.forEach((observer, index) => {
        if (observer && refs[index].current) {
          observer.unobserve(refs[index].current!)
        }
      })
    }
  }, [activeTab, categorizedReservations.upcoming.length, currentTime])

  // Determine refresh interval based on active reservations (smart polling)
  const refreshInterval = useMemo(() => {
    const hasActiveReservations = upcomingSections.now.length > 0 || upcomingSections.today.length > 0
    // More frequent when there are active reservations (15s), less frequent otherwise (30s)
    return hasActiveReservations ? 15000 : 30000
  }, [upcomingSections])

  const handleRefresh = useCallback(async (mode: "manual" | "auto" | "focus" | "visible") => {
    if (refreshInFlightRef.current) return
    refreshInFlightRef.current = true

    const showToastOnSuccess = mode === "manual"
    const showSpinner = mode === "manual"
    if (showSpinner) setIsRefreshing(true)
    try {
      const response = await fetch(`/api/venues/${venue.id}/reservations`)
      if (response.ok) {
        const data = await response.json()
        setReservations(data.reservations)
        setSeatBlocks(data.seatBlocks)
        setLastUpdated(new Date())
        // Only show toast for manual refreshes
        if (showToastOnSuccess) {
          showToast("Refreshed", "success")
        }
      } else {
        if (showToastOnSuccess) {
          showToast("Failed to refresh", "error")
        }
      }
    } catch (error) {
      console.error("Error refreshing:", error)
      if (showToastOnSuccess) {
        showToast("Failed to refresh", "error")
      }
    } finally {
      refreshInFlightRef.current = false
      if (showSpinner) setIsRefreshing(false)
    }
  }, [venue.id, showToast])

  // Refresh when window regains focus
  useEffect(() => {
    const handleFocus = () => {
      handleRefresh("focus")
    }
    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
  }, [handleRefresh])

  // Refresh when tab becomes visible
  useEffect(() => {
    if (isTabVisible) {
      handleRefresh("visible")
    }
  }, [isTabVisible, handleRefresh])

  // Auto-refresh with smart polling and tab visibility handling
  useEffect(() => {
    if (!isTabVisible) return // Don't poll when tab is hidden

    const interval = setInterval(() => {
      handleRefresh("auto")
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [refreshInterval, isTabVisible, handleRefresh])

  // Filter reservations based on active tab and search
  const filteredReservations = useMemo(() => {
    let filtered: Reservation[] = []

    // Select based on tab
    if (activeTab === "upcoming") {
      filtered = categorizedReservations.upcoming
    } else if (activeTab === "past") {
      filtered = categorizedReservations.past
    } else {
      filtered = categorizedReservations.cancelled
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((r) => {
        const booker = getBookerDisplay(r)
        const seatInfo = getReservationSeatInfo(r)
        return (
          booker.toLowerCase().includes(query) ||
          seatInfo.toLowerCase().includes(query) ||
          r.id.toLowerCase().includes(query)
        )
      })
    }

    return filtered
  }, [categorizedReservations, activeTab, searchQuery])

  // Helper function to render a reservation card
  const renderReservationCard = (reservation: Reservation) => {
    const start = typeof reservation.startAt === "string" ? new Date(reservation.startAt) : reservation.startAt
    const end = typeof reservation.endAt === "string" ? new Date(reservation.endAt) : reservation.endAt
    const isActive = reservation.status !== "cancelled"
    const isNow = isReservationActive(reservation, currentTime)

    return (
      <div
        key={reservation.id}
        className={cn(
          "rounded-lg border p-4 transition-colors",
          isNow && "bg-primary/5 border-primary/20"
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {formatTimeRange(start, end)}
              </span>
              {!isToday(start) && (
                <span className="text-xs text-muted-foreground">
                  {formatDate(start)}
                </span>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {getReservationSeatInfo(reservation)}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span>{getBookerDisplay(reservation)}</span>
            </div>
            <span
              className={cn(
                "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                isActive
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
              )}
            >
              {isActive ? "Active" : "Cancelled"}
            </span>
          </div>
          {isActive && (
            <div className="flex gap-2 sm:flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingReservation(reservation)}
                className="flex-1 sm:flex-initial"
              >
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCancelReservation(reservation.id)}
                className="flex-1 sm:flex-initial"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const handleCancelReservation = async (reservationId: string) => {
    if (!confirm("Are you sure you want to cancel this reservation?")) {
      return
    }

    try {
      const response = await fetch(`/api/reservations/${reservationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to cancel")
      }

      // Update local state
      setReservations((prev) =>
        prev.map((r) => (r.id === reservationId ? { ...r, status: "cancelled" } : r))
      )
      showToast("Reservation cancelled", "success")
    } catch (error: any) {
      showToast(error.message || "Failed to cancel reservation", "error")
    }
  }

  const handleEditReservation = async (reservationId: string, updates: {
    startAt: string
    endAt: string
    seatId?: string | null
  }) => {
    try {
      const response = await fetch(`/api/reservations/${reservationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to update")
      }

      const data = await response.json()
      // Refresh data
      await handleRefresh(false)
      setEditingReservation(null)
      showToast("Reservation updated", "success")
    } catch (error: any) {
      showToast(error.message || "Failed to update reservation", "error")
    }
  }

  const handleBlockSeat = async (seatId: string | null, startAt: string, endAt: string, reason?: string) => {
    try {
      const response = await fetch(`/api/venues/${venue.id}/seat-blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seatId: seatId || null,
          startAt,
          endAt,
          reason,
          duration: "custom",
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to block seat")
      }

      await handleRefresh(false)
      setBlockingSeat(null)
      showToast("Seat blocked", "success")
    } catch (error: any) {
      showToast(error.message || "Failed to block seat", "error")
    }
  }

  const handleUnblockSeat = async (blockId: string) => {
    try {
      const response = await fetch(`/api/venues/${venue.id}/seat-blocks/${blockId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to unblock")
      }

      await handleRefresh(false)
      showToast("Seat unblocked", "success")
    } catch (error: any) {
      showToast("Failed to unblock seat", "error")
    }
  }

  // Get seat status for a given seat
  const getSeatStatus = (seatId: string): "available" | "reserved" | "blocked" => {
    // Check if blocked
    const activeBlocks = seatBlocks.filter((block) => {
      if (block.seatId !== seatId) return false
      const start = new Date(block.startAt)
      const end = new Date(block.endAt)
      return start <= currentTime && currentTime < end
    })
    if (activeBlocks.length > 0) {
      return "blocked"
    }

    // Check if reserved
    const activeReservation = reservations.find((r) => {
      if (r.seatId !== seatId || r.status === "cancelled") return false
      const start = new Date(r.startAt)
      const end = new Date(r.endAt)
      return start <= currentTime && currentTime < end
    })
    if (activeReservation) {
      return "reserved"
    }

    return "available"
  }

  // Format last updated time
  const lastUpdatedText = useMemo(() => {
    const minutes = Math.floor((new Date().getTime() - lastUpdated.getTime()) / 60000)
    if (minutes < 1) return "Just now"
    if (minutes === 1) return "1 minute ago"
    return `${minutes} minutes ago`
  }, [lastUpdated])

  return (
    <div className="min-h-screen bg-background">
      {ToastComponent}

      {/* Top Bar - Sticky */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight">{venue.name}</h1>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                Published
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                {currentTime.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}{" "}
                {currentTime.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/venue/dashboard/${venue.id}/edit`}>
                  <Settings className="mr-1.5 h-3.5 w-3.5" />
                  Settings
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/venue/${venue.id}`}>
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  View listing
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left Column: Reservations Timeline */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Reservations</CardTitle>
                <CardDescription>Manage upcoming bookings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Tabs */}
                <div className="flex gap-2 border-b">
                  <button
                    onClick={() => setActiveTab("upcoming")}
                    className={cn(
                      "px-4 py-2 text-sm font-medium transition-colors",
                      activeTab === "upcoming"
                        ? "border-b-2 border-primary text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Upcoming ({categorizedReservations.upcoming.length})
                  </button>
                  <button
                    onClick={() => setActiveTab("past")}
                    className={cn(
                      "px-4 py-2 text-sm font-medium transition-colors",
                      activeTab === "past"
                        ? "border-b-2 border-primary text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Past ({categorizedReservations.past.length})
                  </button>
                  <button
                    onClick={() => setActiveTab("cancelled")}
                    className={cn(
                      "px-4 py-2 text-sm font-medium transition-colors",
                      activeTab === "cancelled"
                        ? "border-b-2 border-primary text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Cancelled ({categorizedReservations.cancelled.length})
                  </button>
                </div>

                {/* Search */}
                <div>
                  <input
                    type="text"
                    placeholder="Search by email, seat, or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                {/* Reservations List */}
                <div className="space-y-2 max-h-[600px] overflow-y-auto relative">
                  {/* Sticky Section Header (only for upcoming tab) */}
                  {activeTab === "upcoming" && (
                    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b pb-2 mb-2 -mx-2 px-2">
                      <h3 className="text-sm font-semibold">{visibleSection}</h3>
                    </div>
                  )}
                  {activeTab === "upcoming" ? (
                    // Upcoming tab with sections
                    (() => {
                      const allUpcoming = [...upcomingSections.now, ...upcomingSections.today, ...upcomingSections.week]
                      const filteredUpcoming = searchQuery.trim()
                        ? allUpcoming.filter((r) => {
                            const query = searchQuery.toLowerCase()
                            const booker = getBookerDisplay(r)
                            const seatInfo = getReservationSeatInfo(r)
                            return (
                              booker.toLowerCase().includes(query) ||
                              seatInfo.toLowerCase().includes(query) ||
                              r.id.toLowerCase().includes(query)
                            )
                          })
                        : allUpcoming

                      if (filteredUpcoming.length === 0) {
                        return (
                          <p className="py-8 text-center text-sm text-muted-foreground">
                            No upcoming reservations found
                          </p>
                        )
                      }

                      return (
                        <>
                          {/* Now Section */}
                          {upcomingSections.now.length > 0 && (
                            <div ref={nowSectionRef} className="space-y-2">
                              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">
                                Now
                              </h4>
                              {upcomingSections.now
                                .filter((r) => {
                                  if (!searchQuery.trim()) return true
                                  const query = searchQuery.toLowerCase()
                                  const booker = getBookerDisplay(r)
                                  const seatInfo = getReservationSeatInfo(r)
                                  return (
                                    booker.toLowerCase().includes(query) ||
                                    seatInfo.toLowerCase().includes(query) ||
                                    r.id.toLowerCase().includes(query)
                                  )
                                })
                                .map((reservation) => {
                                  return renderReservationCard(reservation)
                                })}
                            </div>
                          )}

                          {/* Today Section */}
                          {upcomingSections.today.length > 0 && (
                            <div ref={todaySectionRef} className="space-y-2">
                              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">
                                Today
                              </h4>
                              {upcomingSections.today
                                .filter((r) => {
                                  if (!searchQuery.trim()) return true
                                  const query = searchQuery.toLowerCase()
                                  const booker = getBookerDisplay(r)
                                  const seatInfo = getReservationSeatInfo(r)
                                  return (
                                    booker.toLowerCase().includes(query) ||
                                    seatInfo.toLowerCase().includes(query) ||
                                    r.id.toLowerCase().includes(query)
                                  )
                                })
                                .map((reservation) => {
                                  return renderReservationCard(reservation)
                                })}
                            </div>
                          )}

                          {/* This week Section */}
                          {upcomingSections.week.length > 0 && (
                            <div ref={weekSectionRef} className="space-y-2">
                              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">
                                This week
                              </h4>
                              {upcomingSections.week
                                .filter((r) => {
                                  if (!searchQuery.trim()) return true
                                  const query = searchQuery.toLowerCase()
                                  const booker = getBookerDisplay(r)
                                  const seatInfo = getReservationSeatInfo(r)
                                  return (
                                    booker.toLowerCase().includes(query) ||
                                    seatInfo.toLowerCase().includes(query) ||
                                    r.id.toLowerCase().includes(query)
                                  )
                                })
                                .map((reservation) => {
                                  return renderReservationCard(reservation)
                                })}
                            </div>
                          )}
                        </>
                      )
                    })()
                  ) : filteredReservations.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No reservations found
                    </p>
                  ) : (
                    // Past and Cancelled tabs - flat list
                    filteredReservations.map((reservation) => {
                      return renderReservationCard(reservation)
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Seat Status + Quick Actions */}
          <div className="space-y-4">
            {/* Seat Status Panel */}
            <Card>
              <CardHeader>
                <CardTitle>Seat Status</CardTitle>
                <CardDescription>Current availability and blocks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {venue.tables.map((table) => (
                  <div key={table.id} className="space-y-2">
                    <h4 className="text-sm font-medium">{table.name || "Unnamed Table"}</h4>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {table.seats.map((seat) => {
                        const status = getSeatStatus(seat.id)
                        const seatLabel = getSeatLabel(seat)

                        return (
                          <button
                            key={seat.id}
                            onClick={() =>
                              setSelectedSeat({
                                seatId: seat.id,
                                tableName: table.name || "Table",
                              })
                            }
                            className={cn(
                              "rounded-lg border p-3 text-left transition-colors",
                              status === "available" && "bg-muted/30 hover:bg-muted/50",
                              status === "reserved" && "bg-amber-50 border-amber-200",
                              status === "blocked" && "bg-red-50 border-red-200"
                            )}
                          >
                            <div className="text-xs font-medium">{seatLabel}</div>
                            <div className="text-xs text-muted-foreground">
                              ${seat.pricePerHour}/hr
                            </div>
                            <div className="mt-1">
                              <span
                                className={cn(
                                  "inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
                                  status === "available" && "bg-muted text-muted-foreground",
                                  status === "reserved" && "bg-amber-100 text-amber-700",
                                  status === "blocked" && "bg-red-100 text-red-700"
                                )}
                              >
                                {status === "available" && "Available"}
                                {status === "reserved" && "Reserved now"}
                                {status === "blocked" && "Blocked"}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setBlockingSeat({ seatId: null, tableName: "" })}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  Block seat
                </Button>
                <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-foreground">Last updated:</span>
                    <span className="text-muted-foreground">{lastUpdatedText}</span>
                    {isRefreshing && (
                      <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleRefresh("manual")}
                    disabled={isRefreshing}
                  >
                    <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isRefreshing && "animate-spin")} />
                    {isRefreshing ? "Refreshing..." : "Refresh"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Edit Reservation Modal */}
      <Dialog open={!!editingReservation} onOpenChange={(open) => !open && setEditingReservation(null)}>
        {editingReservation && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Reservation</DialogTitle>
              <DialogDescription>
                Update the time or seat for this reservation
              </DialogDescription>
            </DialogHeader>
            <EditReservationForm
              reservation={editingReservation}
              venue={venue}
              onSave={(updates) => {
                handleEditReservation(editingReservation.id, updates)
              }}
              onCancel={() => setEditingReservation(null)}
            />
          </DialogContent>
        )}
      </Dialog>

      {/* Block Seat Modal */}
      <Dialog open={!!blockingSeat} onOpenChange={(open) => !open && setBlockingSeat(null)}>
        {blockingSeat && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Block Seat</DialogTitle>
              <DialogDescription>
                Temporarily block this seat from bookings
              </DialogDescription>
            </DialogHeader>
            <BlockSeatForm
              seatId={blockingSeat.seatId}
              tableName={blockingSeat.tableName}
              onSave={(startAt, endAt, reason) => {
                handleBlockSeat(blockingSeat.seatId, startAt, endAt, reason)
              }}
              onCancel={() => setBlockingSeat(null)}
            />
          </DialogContent>
        )}
      </Dialog>

      {/* Seat Detail Modal */}
      <Dialog open={!!selectedSeat} onOpenChange={(open) => !open && setSelectedSeat(null)}>
        {selectedSeat && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Seat Details</DialogTitle>
              <DialogDescription>
                {getSeatLabel(
                  venue.tables
                    .flatMap((t) => t.seats)
                    .find((s) => s.id === selectedSeat.seatId)
                )}{" "}
                at {selectedSeat.tableName}
              </DialogDescription>
            </DialogHeader>
            <SeatDetailView
              seatId={selectedSeat.seatId}
              tableName={selectedSeat.tableName}
              reservations={reservations.filter((r) => r.seatId === selectedSeat.seatId)}
              seatBlocks={seatBlocks.filter((b) => b.seatId === selectedSeat.seatId)}
              currentTime={currentTime}
              onBlock={() => {
                setSelectedSeat(null)
                setBlockingSeat(selectedSeat)
              }}
              onUnblock={handleUnblockSeat}
              venueId={venue.id}
            />
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}

// Edit Reservation Form Component
function EditReservationForm({
  reservation,
  venue,
  onSave,
  onCancel,
}: {
  reservation: Reservation
  venue: { id: string; tables: Array<{ id: string; name: string | null; seats: Array<{ id: string; label: string | null }> }> }
  onSave: (updates: { startAt: string; endAt: string; seatId?: string | null }) => void
  onCancel: () => void
}) {
  const start = typeof reservation.startAt === "string" ? new Date(reservation.startAt) : reservation.startAt
  const end = typeof reservation.endAt === "string" ? new Date(reservation.endAt) : reservation.endAt

  const [startDate, setStartDate] = useState(start.toISOString().split("T")[0])
  const [startTime, setStartTime] = useState(start.toTimeString().slice(0, 5))
  const [duration, setDuration] = useState(
    Math.round((end.getTime() - start.getTime()) / (60 * 60 * 1000))
  )
  const [seatId, setSeatId] = useState(reservation.seatId || "")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const start = new Date(`${startDate}T${startTime}`)
    const end = new Date(start.getTime() + duration * 60 * 60 * 1000)
    onSave({
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      seatId: seatId || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium">Date</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          required
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">Start time</label>
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          required
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">Duration (hours)</label>
        <select
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {[1, 2, 3, 4, 5, 6, 7, 8].map((h) => (
            <option key={h} value={h}>
              {h} {h === 1 ? "hour" : "hours"}
            </option>
          ))}
        </select>
      </div>
      {reservation.seatId ? (
        <div>
          <label className="mb-2 block text-sm font-medium">Seat (optional)</label>
          <select
            value={seatId}
            onChange={(e) => setSeatId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Keep current seat</option>
            {venue.tables.flatMap((table) =>
              table.seats.map((seat) => (
                <option key={seat.id} value={seat.id}>
                  {getSeatLabel(seat)} at {table.name || "Table"}
                </option>
              ))
            )}
          </select>
        </div>
      ) : (
        <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          This is a group table booking. Seat changes are not supported for group bookings.
        </div>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save changes</Button>
      </DialogFooter>
    </form>
  )
}

// Block Seat Form Component
function BlockSeatForm({
  seatId,
  tableName,
  onSave,
  onCancel,
}: {
  seatId: string | null
  tableName: string
  onSave: (startAt: string, endAt: string, reason?: string) => void
  onCancel: () => void
}) {
  const [duration, setDuration] = useState<"1hour" | "today" | "custom">("today")
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0])
  const [startTime, setStartTime] = useState(new Date().toTimeString().slice(0, 5))
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0])
  const [endTime, setEndTime] = useState("23:59")
  const [reason, setReason] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const start = new Date(`${startDate}T${startTime}`)
    let end: Date

    if (duration === "1hour") {
      end = new Date(start.getTime() + 60 * 60 * 1000)
    } else if (duration === "today") {
      end = new Date(start)
      end.setHours(23, 59, 59, 999)
    } else {
      end = new Date(`${endDate}T${endTime}`)
    }

    onSave(start.toISOString(), end.toISOString(), reason.trim() || undefined)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {seatId ? (
        <div className="rounded-md bg-muted p-3 text-sm">
          Blocking seat at {tableName}
        </div>
      ) : (
        <div className="rounded-md bg-muted p-3 text-sm">
          Blocking venue-wide (all seats)
        </div>
      )}
      <div>
        <label className="mb-2 block text-sm font-medium">Start</label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            required
          />
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            required
          />
        </div>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">Duration</label>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="duration"
              value="1hour"
              checked={duration === "1hour"}
              onChange={(e) => setDuration(e.target.value as any)}
            />
            <span className="text-sm">1 hour</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="duration"
              value="today"
              checked={duration === "today"}
              onChange={(e) => setDuration(e.target.value as any)}
            />
            <span className="text-sm">Today (until end of day)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="duration"
              value="custom"
              checked={duration === "custom"}
              onChange={(e) => setDuration(e.target.value as any)}
            />
            <span className="text-sm">Custom</span>
          </label>
        </div>
      </div>
      {duration === "custom" && (
        <div>
          <label className="mb-2 block text-sm font-medium">End</label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            />
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            />
          </div>
        </div>
      )}
      <div>
        <label className="mb-2 block text-sm font-medium">Reason (optional)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="e.g., Broken chair, maintenance..."
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Block seat</Button>
      </DialogFooter>
    </form>
  )
}

// Seat Detail View Component
function SeatDetailView({
  seatId,
  tableName,
  reservations,
  seatBlocks,
  currentTime,
  onBlock,
  onUnblock,
  venueId,
}: {
  seatId: string
  tableName: string
  reservations: Reservation[]
  seatBlocks: SeatBlock[]
  currentTime: Date
  onBlock: () => void
  onUnblock: (blockId: string) => void
  venueId: string
}) {
  const todayReservations = reservations.filter((r) => {
    const start = typeof r.startAt === "string" ? new Date(r.startAt) : r.startAt
    const today = new Date(currentTime)
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return start >= today && start < tomorrow
  })

  const activeBlocks = seatBlocks.filter((block) => {
    const start = typeof block.startAt === "string" ? new Date(block.startAt) : block.startAt
    const end = typeof block.endAt === "string" ? new Date(block.endAt) : block.endAt
    return start <= currentTime && currentTime < end
  })

  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-2 text-sm font-medium">Today&apos;s Reservations</h4>
        {todayReservations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reservations today</p>
        ) : (
          <div className="space-y-2">
            {todayReservations.map((r) => {
              const start = typeof r.startAt === "string" ? new Date(r.startAt) : r.startAt
              const end = typeof r.endAt === "string" ? new Date(r.endAt) : r.endAt
              return (
                <div key={r.id} className="rounded-md border p-2 text-sm">
                  <div className="font-medium">{formatTimeRange(start, end)}</div>
                  <div className="text-xs text-muted-foreground">
                    {getBookerDisplay(r)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {activeBlocks.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium">Active Blocks</h4>
          <div className="space-y-2">
            {activeBlocks.map((block) => {
              const start = typeof block.startAt === "string" ? new Date(block.startAt) : block.startAt
              const end = typeof block.endAt === "string" ? new Date(block.endAt) : block.endAt
              return (
                <div key={block.id} className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 p-2">
                  <div className="text-sm">
                    <div className="font-medium text-red-900">Blocked</div>
                    <div className="text-xs text-red-700">
                      {formatTimeRange(start, end)}
                    </div>
                    {block.reason && (
                      <div className="mt-1 text-xs text-red-600">{block.reason}</div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onUnblock(block.id)}
                  >
                    Unblock
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Button className="w-full" onClick={onBlock}>
        <Ban className="mr-2 h-4 w-4" />
        Block this seat
      </Button>
    </div>
  )
}
