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
  Plus,
  CreditCard,
  Printer,
  Download,
  XCircle,
  ChevronDown,
  PauseCircle,
  PlayCircle,
  UserMinus,
  Undo2,
  Loader2,
} from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { DealList } from "@/components/venue/DealList"
import { DealForm } from "@/components/venue/DealForm"
import { SignageOrderWizard } from "@/components/venue/SignageOrderWizard"
import { type Deal } from "@prisma/client"
import { useVenueRole } from "./VenueRoleProvider"

interface VenueOpsConsoleClientProps {
  venue: {
    id: string
    name: string
    status?: string
    pauseMessage?: string | null
    openingHoursJson?: any
    stripeAccountId?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    zipCode?: string | null
    ownerFirstName?: string | null
    ownerLastName?: string | null
    tables: Array<{
      id: string
      name: string | null
      bookingMode: string | null
      tablePricePerHour: number | null
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
  deals: Deal[]
  now: string
  assignedQrByResourceKey?: Record<string, string>
  venueQrToken?: string | null
  signageOrders?: Array<{
    id: string
    status: string
    createdAt: Date | string
    template: { name: string }
    items: Array<{
      id: string
      label: string
      qrScopeType: string
      qrAsset: { token: string }
    }>
    contactName: string
    contactEmail: string
    contactPhone: string | null
    shipAddress1: string
    shipAddress2: string | null
    shipCity: string
    shipState: string
    shipPostalCode: string
    shipCountry: string
    shippingNotes: string | null
    trackingCarrier: string | null
    trackingNumber: string | null
    shippedAt: Date | string | null
    deliveredAt: Date | string | null
  }>
}

type TabMode = "upcoming" | "past" | "cancelled"

export function VenueOpsConsoleClient({
  venue,
  reservations: initialReservations,
  seatBlocks: initialSeatBlocks,
  deals: initialDeals,
  now: initialNow,
  assignedQrByResourceKey = {},
  venueQrToken: initialVenueQrToken = null,
  signageOrders: initialSignageOrders = [],
}: VenueOpsConsoleClientProps) {
  const router = useRouter()
  const { showToast, ToastComponent } = useToast()
  const venueRole = useVenueRole()
  const showStripe = venueRole === "admin" || venueRole === null
  const showTeam = venueRole === "admin" || venueRole === null
  // QR Code Management (order signage, generate QR) visible to all dashboard users (admin, staff, owner)
  const showQrManagement = venueRole === "admin" || venueRole === "staff" || venueRole === null
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; email: string; role: string }>>([])
  const [teamMembersLoading, setTeamMembersLoading] = useState(false)
  const [newMemberEmail, setNewMemberEmail] = useState("")
  const [addMemberLoading, setAddMemberLoading] = useState(false)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const [deals, setDeals] = useState<Deal[]>(initialDeals || [])
  const [printQRModal, setPrintQRModal] = useState<{ token: string } | null>(null)
  const [printQRLoading, setPrintQRLoading] = useState<string | null>(null)
  const [localQrTokensByKey, setLocalQrTokensByKey] = useState<Record<string, string>>({})
  const [retiringKey, setRetiringKey] = useState<string | null>(null)
  const [venueQrLoading, setVenueQrLoading] = useState(false)
  const [venueQrRetiring, setVenueQrRetiring] = useState(false)
  const [localVenueQrToken, setLocalVenueQrToken] = useState<string | null>(null)
  const [qrManagementOpen, setQrManagementOpen] = useState(false)
  const [signageOrdersOpen, setSignageOrdersOpen] = useState(false)
  const [selectedSignageOrder, setSelectedSignageOrder] = useState<
    NonNullable<VenueOpsConsoleClientProps["signageOrders"]>[number] | null
  >(null)
  const [signageOrderWizardOpen, setSignageOrderWizardOpen] = useState(false)
  const [teamManagementOpen, setTeamManagementOpen] = useState(false)
  const [dealFormOpen, setDealFormOpen] = useState(false)
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null)

  const [reservations, setReservations] = useState(initialReservations)
  const [seatBlocks, setSeatBlocks] = useState(initialSeatBlocks)
  const [currentTime, setCurrentTime] = useState(new Date(initialNow))
  const [activeTab, setActiveTab] = useState<TabMode>("upcoming")
  const [searchQuery, setSearchQuery] = useState("")
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)
  const [blockingSeat, setBlockingSeat] = useState<{ seatId: string | null; tableName: string } | null>(null)
  const [selectedSeat, setSelectedSeat] = useState<{ seatId: string; tableId: string; tableName: string; isGroupTable?: boolean } | null>(null)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isTabVisible, setIsTabVisible] = useState(true)
  const refreshInFlightRef = useRef(false)
  const [isStripeConnecting, setIsStripeConnecting] = useState(false)
  const [stripeStatus, setStripeStatus] = useState<{
    needsOnboarding: boolean
    messages: string[]
    disabledReason: string | null
    status: "missing" | "ok" | "needs_attention" | "error"
  } | null>(null)
  const [stripeBalance, setStripeBalance] = useState<{
    available: number
    pending: number
    instantAvailable: number
    currency: string
  } | null>(null)
  const [isPayoutDialogOpen, setIsPayoutDialogOpen] = useState(false)
  const [payoutAmount, setPayoutAmount] = useState("")
  const [isPayoutSubmitting, setIsPayoutSubmitting] = useState(false)
  const [isStripeDashboardOpening, setIsStripeDashboardOpening] = useState(false)
  const [stripeLoading, setStripeLoading] = useState(true)
  const [venueStatus, setVenueStatus] = useState<string>(venue.status ?? "ACTIVE")
  const [venuePauseMessage, setVenuePauseMessage] = useState<string | null>(venue.pauseMessage ?? null)
  const [pauseUnpauseLoading, setPauseUnpauseLoading] = useState(false)
  const [pauseModalOpen, setPauseModalOpen] = useState(false)
  const [pauseMessageInput, setPauseMessageInput] = useState("")
  const [cancelFutureOnPause, setCancelFutureOnPause] = useState(false)
  const [deleteVenueModalOpen, setDeleteVenueModalOpen] = useState(false)
  const [deleteVenueConfirmation, setDeleteVenueConfirmation] = useState("")
  const [deleteVenueLoading, setDeleteVenueLoading] = useState(false)
  const [deleteVenueError, setDeleteVenueError] = useState<string | null>(null)

  // Refs for intersection observer (sticky header)
  const nowSectionRef = useRef<HTMLDivElement>(null)
  const todaySectionRef = useRef<HTMLDivElement>(null)
  const weekSectionRef = useRef<HTMLDivElement>(null)

  const [visibleSection, setVisibleSection] = useState<"Now" | "Today" | "This week">("Now")

  const fetchTeamMembers = useCallback(() => {
    if (!showTeam) return
    setTeamMembersLoading(true)
    fetch(`/api/venues/${venue.id}/members`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.members) setTeamMembers(data.members)
      })
      .finally(() => setTeamMembersLoading(false))
  }, [venue.id, showTeam])

  useEffect(() => {
    fetchTeamMembers()
  }, [fetchTeamMembers])

  const hasQrForResource = useCallback(
    (resourceType: "seat" | "table", resourceId: string) => {
      const key = `${resourceType}:${resourceId}`
      return key in assignedQrByResourceKey || key in localQrTokensByKey
    },
    [assignedQrByResourceKey, localQrTokensByKey]
  )

  const getTokenForResource = useCallback(
    (resourceType: "seat" | "table", resourceId: string): string | undefined => {
      const key = `${resourceType}:${resourceId}`
      return assignedQrByResourceKey[key] ?? localQrTokensByKey[key]
    },
    [assignedQrByResourceKey, localQrTokensByKey]
  )

  const handlePrintQR = useCallback(
    async (resourceType: "seat" | "table", resourceId: string) => {
      const key = `${resourceType}:${resourceId}`
      setPrintQRLoading(key)
      try {
        const res = await fetch("/api/qr-assets/allocate-and-assign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            venueId: venue.id,
            resourceType,
            resourceId,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          showToast(data.error || "Failed to get QR", "error")
          return
        }
        setLocalQrTokensByKey((prev) => ({ ...prev, [key]: data.token }))
        setPrintQRModal({ token: data.token })
      } catch {
        showToast("Failed to get QR", "error")
      } finally {
        setPrintQRLoading(null)
      }
    },
    [venue.id, showToast]
  )

  const handleRetire = useCallback(
    async (resourceType: "seat" | "table", resourceId: string) => {
      const key = `${resourceType}:${resourceId}`
      const token = getTokenForResource(resourceType, resourceId)
      if (!token) {
        showToast("No QR assigned to this resource", "error")
        return
      }
      if (!confirm("Retire this QR? It will no longer be active.")) return
      setRetiringKey(key)
      try {
        const res = await fetch("/api/qr-assets/retire", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          showToast(data.error || "Failed to retire QR", "error")
          return
        }
        setLocalQrTokensByKey((prev) => {
          const next = { ...prev }
          delete next[key]
          return next
        })
        router.refresh()
        showToast("QR retired", "success")
      } catch {
        showToast("Failed to retire QR", "error")
      } finally {
        setRetiringKey(null)
      }
    },
    [getTokenForResource, showToast, router]
  )

  const effectiveVenueQrToken = localVenueQrToken ?? initialVenueQrToken ?? null

  const handleVenueQRGenerate = useCallback(async () => {
    setVenueQrLoading(true)
    try {
      const res = await fetch("/api/qr-assets/allocate-and-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId: venue.id,
          resourceType: "venue",
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || "Failed to get venue QR", "error")
        return
      }
      setLocalVenueQrToken(data.token)
      setPrintQRModal({ token: data.token })
    } catch {
      showToast("Failed to get venue QR", "error")
    } finally {
      setVenueQrLoading(false)
    }
  }, [venue.id, showToast])

  const handleVenueQRRetire = useCallback(async () => {
    const token = effectiveVenueQrToken
    if (!token) {
      showToast("No venue QR assigned", "error")
      return
    }
    if (!confirm("Retire this QR? It will no longer be active.")) return
    setVenueQrRetiring(true)
    try {
      const res = await fetch("/api/qr-assets/retire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || "Failed to retire venue QR", "error")
        return
      }
      setLocalVenueQrToken(null)
      router.refresh()
      showToast("Venue QR retired", "success")
    } catch {
      showToast("Failed to retire venue QR", "error")
    } finally {
      setVenueQrRetiring(false)
    }
  }, [effectiveVenueQrToken, showToast, router])

  const handlePause = useCallback(async () => {
    setPauseModalOpen(false)
    setPauseUnpauseLoading(true)
    try {
      const res = await fetch(`/api/venues/${venue.id}/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pauseMessage: pauseMessageInput.trim() || undefined,
          cancelFutureReservations: cancelFutureOnPause,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || "Failed to pause venue", "error")
        return
      }
      setVenueStatus("PAUSED")
      setVenuePauseMessage(data.venue?.pauseMessage ?? (pauseMessageInput.trim() || null))
      if (cancelFutureOnPause) {
        router.refresh()
      }
      showToast("Venue paused. New reservations are blocked.", "success")
    } catch {
      showToast("Failed to pause venue", "error")
    } finally {
      setPauseUnpauseLoading(false)
    }
  }, [venue.id, pauseMessageInput, cancelFutureOnPause, showToast, router])

  const handleUnpause = useCallback(async () => {
    setPauseUnpauseLoading(true)
    try {
      const res = await fetch(`/api/venues/${venue.id}/unpause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || "Failed to resume venue", "error")
        return
      }
      setVenueStatus("ACTIVE")
      setVenuePauseMessage(null)
      showToast("Venue is accepting reservations again.", "success")
    } catch {
      showToast("Failed to resume venue", "error")
    } finally {
      setPauseUnpauseLoading(false)
    }
  }, [venue.id, showToast])

  const handleDeleteVenue = useCallback(async () => {
    const expected = venue.name?.trim() || "DELETE"
    if (deleteVenueConfirmation !== expected && deleteVenueConfirmation !== "DELETE") {
      setDeleteVenueError(`Type "${venue.name}" or DELETE to confirm.`)
      return
    }
    setDeleteVenueError(null)
    setDeleteVenueLoading(true)
    try {
      const res = await fetch(`/api/venues/${venue.id}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: deleteVenueConfirmation }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || "Failed to delete venue", "error")
        setDeleteVenueError(data.error || "Failed to delete venue")
        return
      }
      showToast("Venue deleted.", "success")
      setDeleteVenueModalOpen(false)
      router.push("/venue/dashboard")
    } catch {
      showToast("Failed to delete venue", "error")
      setDeleteVenueError("Something went wrong.")
    } finally {
      setDeleteVenueLoading(false)
    }
  }, [venue.id, venue.name, deleteVenueConfirmation, showToast, router])

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

  const refreshInterval = 60000 // Once per minute

  const handleRefresh = useCallback(async (mode: "manual" | "auto" | "focus" | "visible") => {
    if (refreshInFlightRef.current) return
    refreshInFlightRef.current = true

    const showToastOnSuccess = mode === "manual"
    const showSpinner = mode === "manual"
    if (showSpinner) setIsRefreshing(true)
    try {
      const [reservationsResponse, dealsResponse] = await Promise.all([
        fetch(`/api/venues/${venue.id}/reservations`),
        fetch(`/api/venues/${venue.id}/deals`),
      ])
      if (reservationsResponse.ok) {
        const data = await reservationsResponse.json()
        setReservations(data.reservations)
        setSeatBlocks(data.seatBlocks)
        setLastUpdated(new Date())
      }
      if (dealsResponse.ok) {
        const dealsData = await dealsResponse.json()
        setDeals(dealsData.deals)
      }
      // Only show toast for manual refreshes
      if (showToastOnSuccess) {
        showToast("Refreshed", "success")
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

  const handleDealRefresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/venues/${venue.id}/deals`)
      if (response.ok) {
        const data = await response.json()
        setDeals(data.deals)
      }
    } catch (error) {
      console.error("Error refreshing deals:", error)
    }
  }, [venue.id])

  const handleAddDeal = () => {
    setEditingDeal(null)
    setDealFormOpen(true)
  }

  const handleEditDeal = (deal: Deal) => {
    setEditingDeal(deal)
    setDealFormOpen(true)
  }

  const handleDealFormSuccess = () => {
    handleDealRefresh()
    setDealFormOpen(false)
    setEditingDeal(null)
  }

  // Refresh when window regains focus
  useEffect(() => {
    const handleFocus = () => {
      handleRefresh("focus")
    }
    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
  }, [handleRefresh])

  // Refresh only when tab transitions from hidden to visible (not on every render while visible)
  const prevTabVisibleRef = useRef(isTabVisible)
  useEffect(() => {
    if (isTabVisible && !prevTabVisibleRef.current) {
      handleRefresh("visible")
    }
    prevTabVisibleRef.current = isTabVisible
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
      await handleRefresh("manual")
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

      await handleRefresh("manual")
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

      await handleRefresh("manual")
      showToast("Seat unblocked", "success")
    } catch (error: any) {
      showToast("Failed to unblock seat", "error")
    }
  }

  // Helper function to normalize dates (handles both Date objects and ISO strings)
  const normalizeDate = (date: Date | string): Date => {
    return typeof date === "string" ? new Date(date) : date
  }

  // Get table status for a group table (table-level bookings only)
  const getTableStatus = (
    tableId: string
  ): {
    status: "available" | "reserved" | "blocked"
    reservation: Reservation | null
    block: SeatBlock | null
  } => {
    // Check if any seat in the table is blocked (for group tables, blocks affect the whole table)
    const table = venue.tables.find((t) => t.id === tableId)
    if (table) {
      const activeBlock = seatBlocks.find((block) => {
        // Check if block is for any seat in this table, or if it's a venue-wide block (seatId is null)
        if (block.seatId === null) {
          // Venue-wide block affects all tables
          const start = normalizeDate(block.startAt)
          const end = normalizeDate(block.endAt)
          return start <= currentTime && currentTime < end
        }
        // Check if block is for a seat in this table
        const isSeatInTable = table.seats.some((seat) => seat.id === block.seatId)
        if (!isSeatInTable) return false
        const start = normalizeDate(block.startAt)
        const end = normalizeDate(block.endAt)
        return start <= currentTime && currentTime < end
      })
      if (activeBlock) {
        return {
          status: "blocked",
          reservation: null,
          block: activeBlock,
        }
      }
    }

    // Check if reserved (table-level reservation only for group tables)
    const activeReservation = reservations.find((r) => {
      if (r.status === "cancelled") return false
      if (r.tableId !== tableId) return false

      const start = normalizeDate(r.startAt)
      const end = normalizeDate(r.endAt)
      const isCurrentlyActive = start <= currentTime && currentTime < end

      return isCurrentlyActive
    })

    if (activeReservation) {
      return {
        status: "reserved",
        reservation: activeReservation,
        block: null,
      }
    }

    return {
      status: "available",
      reservation: null,
      block: null,
    }
  }

  // Get seat status for a given seat (for individual booking mode)
  const getSeatStatus = (
    seatId: string,
    tableId: string,
    bookingMode: string | null
  ): {
    status: "available" | "reserved" | "blocked"
    reservation: Reservation | null
    block: SeatBlock | null
  } => {
    // Check if blocked
    const activeBlock = seatBlocks.find((block) => {
      if (block.seatId !== seatId) return false
      const start = normalizeDate(block.startAt)
      const end = normalizeDate(block.endAt)
      return start <= currentTime && currentTime < end
    })
    if (activeBlock) {
      return {
        status: "blocked",
        reservation: null,
        block: activeBlock,
      }
    }

    // Check if reserved
    const activeReservation = reservations.find((r) => {
      if (r.status === "cancelled") return false

      const start = normalizeDate(r.startAt)
      const end = normalizeDate(r.endAt)
      const isCurrentlyActive = start <= currentTime && currentTime < end

      if (!isCurrentlyActive) return false

      // For individual booking mode, ONLY check seat-level reservations
      // For group booking mode, check table-level reservations
      if (bookingMode === "group") {
        // Group booking mode: check for table-level reservation
        if (r.tableId !== null && r.tableId !== undefined && r.tableId === tableId && r.seatId === null) {
          return true
        }
      } else {
        // Individual booking mode: ONLY check seat-level reservations
        if (r.seatId !== null && r.seatId !== undefined && r.seatId === seatId) {
          return true
        }
      }

      return false
    })

    if (activeReservation) {
      return {
        status: "reserved",
        reservation: activeReservation,
        block: null,
      }
    }

    return {
      status: "available",
      reservation: null,
      block: null,
    }
  }

  // Format last updated time
  const lastUpdatedText = useMemo(() => {
    const minutes = Math.floor((new Date().getTime() - lastUpdated.getTime()) / 60000)
    if (minutes < 1) return "Just now"
    if (minutes === 1) return "1 minute ago"
    return `${minutes} minutes ago`
  }, [lastUpdated])

  useEffect(() => {
    if (!showStripe) return
    let isMounted = true
    fetch(`/api/venues/${venue.id}/stripe/status`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!isMounted || !payload) return
        setStripeStatus(payload)
      })
      .catch(() => {
        if (!isMounted) return
        setStripeStatus({
          needsOnboarding: false,
          messages: ["Unable to load Stripe status. Try again later."],
          disabledReason: null,
          status: "error",
        })
      })
      .finally(() => {
        if (isMounted) setStripeLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [venue.id, showStripe])

  useEffect(() => {
    if (!showStripe) return
    let isMounted = true
    fetch(`/api/venues/${venue.id}/stripe/balance`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!isMounted || !payload) return
        setStripeBalance(payload)
      })
      .catch(() => {
        if (!isMounted) return
        setStripeBalance(null)
      })
    return () => {
      isMounted = false
    }
  }, [venue.id, showStripe])

  const handleStripeConnect = useCallback(async () => {
    if (isStripeConnecting) return
    setIsStripeConnecting(true)
    try {
      const response = await fetch(`/api/venues/${venue.id}/stripe/connect`, {
        method: "POST",
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to start Stripe onboarding.")
      }
      if (!payload?.url) {
        throw new Error("Stripe onboarding link was missing.")
      }
      window.location.assign(payload.url)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Stripe onboarding failed."
      showToast(message, "error")
      setIsStripeConnecting(false)
    }
  }, [isStripeConnecting, showToast, venue.id])

  const stripeButtonLabel = useMemo(() => {
    if (isStripeConnecting) return "Connecting..."
    if (!venue.stripeAccountId) return "Connect Stripe"
    if (stripeStatus?.needsOnboarding) return "Continue onboarding"
    return "Stripe connected"
  }, [isStripeConnecting, stripeStatus?.needsOnboarding, venue.stripeAccountId])

  const stripeAlerts = useMemo(() => {
    if (!stripeStatus) return []
    if (stripeStatus.status === "ok") return []
    const messages = [...(stripeStatus.messages || [])]
    if (stripeStatus.disabledReason) {
      messages.push(`Stripe disabled: ${stripeStatus.disabledReason}`)
    }
    return messages
  }, [stripeStatus])

  const formatMoney = useCallback((amount: number, currency: string) => {
    const value = amount / 100
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(value)
  }, [])

  const payoutAmountCents = useMemo(() => {
    const parsed = Number(payoutAmount)
    if (!Number.isFinite(parsed)) return 0
    return Math.round(parsed * 100)
  }, [payoutAmount])

  const payoutError = useMemo(() => {
    if (!payoutAmount) return null
    if (!Number.isFinite(Number(payoutAmount))) return "Enter a valid number."
    if (payoutAmountCents < 500) return "Minimum payout is $5.00."
    if (stripeBalance && payoutAmountCents > stripeBalance.available) {
      return "Amount exceeds available balance."
    }
    return null
  }, [payoutAmount, payoutAmountCents, stripeBalance])

  const handlePayoutSubmit = useCallback(async () => {
    if (isPayoutSubmitting) return
    if (payoutError) {
      showToast(payoutError, "error")
      return
    }
    if (payoutAmountCents < 500) {
      showToast("Minimum payout is $5.00.", "error")
      return
    }
    setIsPayoutSubmitting(true)
    try {
      const response = await fetch(`/api/venues/${venue.id}/stripe/payouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: payoutAmountCents }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to request payout.")
      }
      showToast("Payout requested.", "success")
      setIsPayoutDialogOpen(false)
      setPayoutAmount("")
      const balanceResponse = await fetch(`/api/venues/${venue.id}/stripe/balance`)
      if (balanceResponse.ok) {
        const balancePayload = await balanceResponse.json()
        setStripeBalance(balancePayload)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payout failed."
      showToast(message, "error")
    } finally {
      setIsPayoutSubmitting(false)
    }
  }, [isPayoutSubmitting, payoutAmountCents, payoutError, showToast, venue.id])

  const handleStripeDashboard = useCallback(async () => {
    if (isStripeDashboardOpening) return
    setIsStripeDashboardOpening(true)
    try {
      const response = await fetch(`/api/venues/${venue.id}/stripe/dashboard`, {
        method: "POST",
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to open Stripe dashboard.")
      }
      if (!payload?.url) {
        throw new Error("Stripe dashboard link missing.")
      }
      window.location.assign(payload.url)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Stripe dashboard failed."
      showToast(message, "error")
      setIsStripeDashboardOpening(false)
    }
  }, [isStripeDashboardOpening, showToast, venue.id])

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white">
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
                <Link href={`/venue/dashboard/${venue.id}/refunds`}>
                  <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                  Refunds
                </Link>
              </Button>
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
        {showStripe && stripeAlerts.length > 0 && (
          <Card className="mb-6 border-amber-200 bg-amber-50 text-amber-900">
            <CardHeader>
              <CardTitle>Stripe needs attention</CardTitle>
              <CardDescription className="text-amber-800">
                Complete onboarding to keep payouts enabled.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {stripeAlerts.map((message, index) => (
                <div key={`${message}-${index}`}>{message}</div>
              ))}
            </CardContent>
          </Card>
        )}
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

          {/* Right Column: Manage Seats + Quick Actions */}
          <div className="space-y-4">
            {showStripe && (
              <Card>
                <CardHeader>
                  <CardTitle>Payouts</CardTitle>
                  <CardDescription>Available Stripe balance</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {stripeLoading ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                      <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                      <p className="text-sm text-muted-foreground animate-pulse">Loading Payouts...</p>
                    </div>
                  ) : !venue.stripeAccountId || stripeStatus?.needsOnboarding ? (
                    <div className="flex flex-col items-center justify-center py-4 text-center space-y-4">
                      <div className="rounded-full bg-primary/5 p-4">
                        <CreditCard className="h-8 w-8 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-semibold">{!venue.stripeAccountId ? "Payments not connected" : "Onboarding incomplete"}</p>
                        <p className="text-sm text-muted-foreground max-w-[240px]">
                          {!venue.stripeAccountId
                            ? "Connect your Stripe account to start receiving payouts for your bookings."
                            : "Please complete your Stripe onboarding to enable payouts."}
                        </p>
                      </div>
                      <Button
                        className="w-full"
                        onClick={handleStripeConnect}
                        disabled={isStripeConnecting}
                      >
                        {isStripeConnecting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <CreditCard className="mr-2 h-4 w-4" />
                            {stripeButtonLabel}
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="rounded-lg border bg-muted/40 p-3">
                          <div className="text-xs text-muted-foreground">Total balance</div>
                          <div className="text-lg font-semibold">
                            {stripeBalance ? (
                              formatMoney(stripeBalance.available + stripeBalance.pending, stripeBalance.currency)
                            ) : (
                              "—"
                            )}
                          </div>
                        </div>
                        <div className="rounded-lg border bg-muted/40 p-3">
                          <div className="text-xs text-muted-foreground">Pending</div>
                          <div className="text-lg font-semibold">
                            {stripeBalance ? (
                              formatMoney(stripeBalance.pending, stripeBalance.currency)
                            ) : (
                              "—"
                            )}
                          </div>
                        </div>
                        <div className="rounded-lg border bg-muted/40 p-3">
                          <div className="text-xs text-muted-foreground">Available</div>
                          <div className="text-lg font-semibold text-emerald-600">
                            {stripeBalance ? (
                              formatMoney(stripeBalance.available, stripeBalance.currency)
                            ) : (
                              "—"
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => setIsPayoutDialogOpen(true)}
                        disabled={!venue.stripeAccountId || stripeStatus?.needsOnboarding}
                      >
                        Request payout
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleStripeDashboard}
                        disabled={!venue.stripeAccountId || isStripeDashboardOpening}
                      >
                        {isStripeDashboardOpening ? "Opening dashboard..." : "Open Stripe dashboard"}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
            {/* Manage Seats Panel */}
            <Card>
              <CardHeader>
                <CardTitle>Manage Seats</CardTitle>
                <CardDescription>Current availability and blocks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {venue.tables.map((table) => {
                  const isGroupTable = table.bookingMode === "group"

                  // For group tables, show a single table card
                  if (isGroupTable) {
                    const tableStatus = getTableStatus(table.id)
                    const { status, reservation, block } = tableStatus
                    const seatCount = table.seats.length
                    const pricePerHour = table.tablePricePerHour || 0

                    return (
                      <div key={table.id} className="space-y-2">
                        <h4 className="text-sm font-medium">{table.name || "Unnamed Table"}</h4>
                        <button
                          onClick={() =>
                            setSelectedSeat({
                              seatId: table.seats[0]?.id || "",
                              tableId: table.id,
                              tableName: table.name || "Table",
                              isGroupTable: true,
                            })
                          }
                          className={cn(
                            "w-full rounded-lg border p-3 text-left transition-colors",
                            status === "available" && "bg-muted/30 hover:bg-muted/50",
                            status === "reserved" && "bg-amber-50 border-amber-200",
                            status === "blocked" && "bg-red-50 border-red-200"
                          )}
                        >
                          <div className="text-xs font-medium">
                            {table.name || "Unnamed Table"} ({seatCount} {seatCount === 1 ? "seat" : "seats"})
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ${pricePerHour.toFixed(0)}/hr
                          </div>
                          <div className="mt-1 space-y-1">
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
                            {status === "reserved" && reservation && (
                              <div className="space-y-0.5 text-[10px] text-muted-foreground">
                                <div>
                                  {formatTimeRange(
                                    normalizeDate(reservation.startAt),
                                    normalizeDate(reservation.endAt)
                                  )}
                                </div>
                                <div>
                                  {getBookerDisplay(reservation)}
                                  <span className="ml-1">
                                    · {reservation.seatCount} seat{reservation.seatCount > 1 ? "s" : ""}
                                  </span>
                                </div>
                              </div>
                            )}
                            {status === "blocked" && block && (
                              <div className="text-[10px] text-red-600">
                                {block.reason || "Blocked"}
                              </div>
                            )}
                          </div>
                        </button>
                      </div>
                    )
                  }

                  // For individual booking mode, show individual seats
                  return (
                    <div key={table.id} className="space-y-2">
                      <h4 className="text-sm font-medium">{table.name || "Unnamed Table"}</h4>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {table.seats.map((seat) => {
                          const seatStatus = getSeatStatus(seat.id, table.id, table.bookingMode)
                          const seatLabel = getSeatLabel(seat)
                          const { status, reservation, block } = seatStatus

                          return (
                            <div key={seat.id} className="flex flex-col gap-1">
                              <button
                                onClick={() =>
                                  setSelectedSeat({
                                    seatId: seat.id,
                                    tableId: table.id,
                                    tableName: table.name || "Table",
                                    isGroupTable: false,
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
                                <div className="mt-1 space-y-1">
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
                                  {status === "reserved" && reservation && (
                                    <div className="space-y-0.5 text-[10px] text-muted-foreground">
                                      <div>
                                        {formatTimeRange(
                                          normalizeDate(reservation.startAt),
                                          normalizeDate(reservation.endAt)
                                        )}
                                      </div>
                                      <div>
                                        {getBookerDisplay(reservation)}
                                        {reservation.tableId && !reservation.seatId && (
                                          <span className="ml-1">
                                            · {reservation.seatCount} seat{reservation.seatCount > 1 ? "s" : ""}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  {status === "blocked" && block && (
                                    <div className="text-[10px] text-red-600">
                                      {block.reason || "Blocked"}
                                    </div>
                                  )}
                                </div>
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Deals */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Deals</CardTitle>
                    <CardDescription>
                      Manage special offers and promotions. Only one deal can be active at a time.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddDeal}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add deal
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <DealList
                  deals={deals}
                  venueId={venue.id}
                  onRefresh={handleDealRefresh}
                  onEdit={handleEditDeal}
                />
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {venue.status !== "DELETED" && (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium",
                          venueStatus === "PAUSED"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-green-100 text-green-800"
                        )}
                      >
                        {venueStatus === "PAUSED" ? "Paused" : "Accepting"}
                      </span>
                      {venueStatus === "PAUSED" && venuePauseMessage && (
                        <span className="text-sm text-muted-foreground">{venuePauseMessage}</span>
                      )}
                    </div>
                    {showStripe && (
                      <div className="flex flex-wrap gap-2">
                        {venueStatus === "ACTIVE" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setPauseMessageInput(venuePauseMessage ?? "")
                              setCancelFutureOnPause(false)
                              setPauseModalOpen(true)
                            }}
                            disabled={pauseUnpauseLoading}
                          >
                            <PauseCircle className="mr-1.5 h-3.5 w-3.5" />
                            Pause reservations
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleUnpause}
                            disabled={pauseUnpauseLoading}
                          >
                            <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                            Resume reservations
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setDeleteVenueModalOpen(true)
                            setDeleteVenueConfirmation("")
                            setDeleteVenueError(null)
                          }}
                        >
                          Delete venue
                        </Button>
                      </div>
                    )}
                  </>
                )}
                {showQrManagement && (
                  <>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                      onClick={() => setQrManagementOpen((open) => !open)}
                    >
                      <span className="flex items-center gap-2">
                        <Printer className="h-4 w-4" />
                        QR Code Management
                      </span>
                      <ChevronDown className={cn("h-4 w-4 transition-transform", qrManagementOpen && "rotate-180")} />
                    </Button>
                    {qrManagementOpen && (
                      <div className="rounded-md border bg-muted/30 overflow-hidden">
                        <div className="max-h-96 overflow-y-auto">
                          {/* Orders section */}
                          <div className="border-b border-border/60 bg-background/50">
                            <p className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Orders
                            </p>
                            <div className="p-1 space-y-0.5 pb-2">
                              {initialSignageOrders.length > 0 && (
                                <>
                                  <div
                                    className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50 cursor-pointer"
                                    onClick={() => setSignageOrdersOpen((open) => !open)}
                                  >
                                    <span className="text-xs font-medium truncate min-w-0">
                                      Manage Existing QR Code Orders
                                    </span>
                                    <ChevronDown className={cn("h-4 w-4 transition-transform", signageOrdersOpen && "rotate-180")} />
                                  </div>
                                  {signageOrdersOpen && (
                                    <div className="pl-2 pb-1 space-y-0.5">
                                      {initialSignageOrders.map((order) => {
                                        const storeCount = order.items.filter((i) => i.qrScopeType === "STORE").length
                                        const tableCount = order.items.filter((i) => i.qrScopeType === "TABLE").length
                                        const seatCount = order.items.filter((i) => i.qrScopeType === "SEAT").length
                                        const statusLabel =
                                          order.status === "NEW"
                                            ? "New"
                                            : order.status === "IN_PRODUCTION"
                                              ? "In production"
                                              : order.status === "SHIPPED"
                                                ? "Shipped"
                                                : order.status === "DELIVERED"
                                                  ? "Delivered"
                                                  : order.status === "CANCELLED"
                                                    ? "Cancelled"
                                                    : order.status
                                        const orderDate = new Date(order.createdAt).toLocaleDateString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                          year: "numeric",
                                        })
                                        return (
                                          <div
                                            key={order.id}
                                            role="button"
                                            tabIndex={0}
                                            className="flex flex-col gap-0.5 rounded px-2 py-1.5 text-sm hover:bg-muted/50 cursor-pointer"
                                            onClick={() => setSelectedSignageOrder(order)}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault()
                                                setSelectedSignageOrder(order)
                                              }
                                            }}
                                          >
                                            <div className="flex items-center justify-between gap-2">
                                              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                                {statusLabel}
                                              </span>
                                              <span className="text-xs text-muted-foreground truncate">{orderDate}</span>
                                            </div>
                                            <span className="text-xs font-medium truncate">{order.template.name}</span>
                                            <span className="text-[10px] text-muted-foreground">
                                              Store: {storeCount} · Tables: {tableCount} · Seats: {seatCount}
                                            </span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </>
                              )}
                              <div
                                className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
                              >
                                <span className="text-xs font-medium truncate min-w-0">
                                  Order QR Code Signage
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[10px] px-1.5"
                                  onClick={() => setSignageOrderWizardOpen(true)}
                                >
                                  Order signage
                                </Button>
                              </div>
                            </div>
                          </div>
                          {/* Generate section */}
                          <div>
                            <p className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Generate QR
                            </p>
                            <div className="p-1 space-y-0.5 pb-2">
                              {/* Venue QR (Register / Front Window) */}
                              <div
                                className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
                              >
                                <span className="text-xs font-medium truncate min-w-0">
                                  Venue QR (Register / Front Window)
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  {effectiveVenueQrToken ? (
                                    <>
                                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                        QR assigned
                                      </span>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-[10px] px-1.5"
                                        onClick={() => {
                                          if (effectiveVenueQrToken) {
                                            setPrintQRModal({ token: effectiveVenueQrToken })
                                          }
                                        }}
                                      >
                                        <Download className="h-2.5 w-2.5 mr-0.5" />
                                        Download
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-[10px] px-1.5 text-muted-foreground hover:text-destructive"
                                        disabled={venueQrRetiring}
                                        onClick={handleVenueQRRetire}
                                      >
                                        {venueQrRetiring ? "..." : <><XCircle className="h-2.5 w-2.5 mr-0.5" /> Retire</>}
                                      </Button>
                                    </>
                                  ) : (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 text-[10px] px-1.5"
                                      disabled={venueQrLoading}
                                      onClick={handleVenueQRGenerate}
                                    >
                                      {venueQrLoading ? "..." : <><Printer className="h-2.5 w-2.5 mr-0.5" /> Generate venue QR</>}
                                    </Button>
                                  )}
                                </div>
                              </div>
                              {venue.tables.length === 0 ? (
                                <p className="text-xs text-muted-foreground px-2 py-3 text-center">No seats or tables yet</p>
                              ) : (
                                venue.tables.flatMap((table) => {
                                  const isGroupTable = table.bookingMode === "group"
                                  if (isGroupTable) {
                                    const tableHasQr = hasQrForResource("table", table.id)
                                    const tableKey = `table:${table.id}`
                                    return [
                                      <div
                                        key={tableKey}
                                        className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
                                      >
                                        <span className="text-xs font-medium truncate min-w-0">
                                          {table.name || "Unnamed Table"}
                                        </span>
                                        <div className="flex items-center gap-1 shrink-0">
                                          {tableHasQr ? (
                                            <>
                                              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                                QR assigned
                                              </span>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 text-[10px] px-1.5"
                                                onClick={() => {
                                                  const token = getTokenForResource("table", table.id)
                                                  if (token) setPrintQRModal({ token })
                                                }}
                                              >
                                                <Download className="h-2.5 w-2.5 mr-0.5" />
                                                Download
                                              </Button>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 text-[10px] px-1.5 text-muted-foreground hover:text-destructive"
                                                disabled={retiringKey !== null}
                                                onClick={() => handleRetire("table", table.id)}
                                              >
                                                {retiringKey === tableKey ? "..." : <><XCircle className="h-2.5 w-2.5 mr-0.5" /> Retire</>}
                                              </Button>
                                            </>
                                          ) : (
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 text-[10px] px-1.5"
                                              disabled={printQRLoading !== null}
                                              onClick={() => handlePrintQR("table", table.id)}
                                            >
                                              {printQRLoading === tableKey ? "..." : <><Printer className="h-2.5 w-2.5 mr-0.5" /> Generate QR</>}
                                            </Button>
                                          )}
                                        </div>
                                      </div>,
                                    ]
                                  }
                                  return table.seats.map((seat) => {
                                    const seatHasQr = hasQrForResource("seat", seat.id)
                                    const seatKey = `seat:${seat.id}`
                                    const tableName = table.name || "Unnamed Table"
                                    const seatLabel = getSeatLabel(seat)
                                    const rowLabel = `${tableName} — ${seatLabel}`
                                    return (
                                      <div
                                        key={seatKey}
                                        className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
                                      >
                                        <span className="text-xs font-medium truncate min-w-0" title={rowLabel}>
                                          {rowLabel}
                                        </span>
                                        <div className="flex items-center gap-1 shrink-0">
                                          {seatHasQr ? (
                                            <>
                                              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                                QR assigned
                                              </span>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 text-[10px] px-1.5"
                                                onClick={() => {
                                                  const token = getTokenForResource("seat", seat.id)
                                                  if (token) setPrintQRModal({ token })
                                                }}
                                              >
                                                <Download className="h-2.5 w-2.5 mr-0.5" />
                                                Download
                                              </Button>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 text-[10px] px-1.5 text-muted-foreground hover:text-destructive"
                                                disabled={retiringKey !== null}
                                                onClick={() => handleRetire("seat", seat.id)}
                                              >
                                                {retiringKey === seatKey ? "..." : <><XCircle className="h-2.5 w-2.5 mr-0.5" /> Retire</>}
                                              </Button>
                                            </>
                                          ) : (
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 text-[10px] px-1.5"
                                              disabled={printQRLoading !== null}
                                              onClick={() => handlePrintQR("seat", seat.id)}
                                            >
                                              {printQRLoading === seatKey ? "..." : <><Printer className="h-2.5 w-2.5 mr-0.5" /> Generate QR</>}
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })
                                })
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
                {showTeam && (
                  <>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                      onClick={() => setTeamManagementOpen((open) => !open)}
                    >
                      <span className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Team Management
                      </span>
                      <ChevronDown className={cn("h-4 w-4 transition-transform", teamManagementOpen && "rotate-180")} />
                    </Button>
                    {teamManagementOpen && (
                      <div className="rounded-md border bg-muted/30 overflow-hidden p-3 space-y-4">
                        <div className="flex gap-2">
                          <Input
                            type="email"
                            placeholder="staff@example.com"
                            value={newMemberEmail}
                            onChange={(e) => setNewMemberEmail(e.target.value)}
                            disabled={addMemberLoading}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            onClick={async () => {
                              const email = newMemberEmail.trim().toLowerCase()
                              if (!email) {
                                showToast("Enter an email address.", "error")
                                return
                              }
                              setAddMemberLoading(true)
                              try {
                                const res = await fetch(`/api/venues/${venue.id}/members`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ email }),
                                })
                                const data = await res.json().catch(() => ({}))
                                if (!res.ok) {
                                  showToast(data.error || "Failed to add member.", "error")
                                  return
                                }
                                setNewMemberEmail("")
                                fetchTeamMembers()
                                showToast("Staff member added.", "success")
                              } finally {
                                setAddMemberLoading(false)
                              }
                            }}
                            disabled={addMemberLoading}
                          >
                            {addMemberLoading ? "Adding..." : "Add member"}
                          </Button>
                        </div>
                        {teamMembersLoading ? (
                          <p className="text-sm text-muted-foreground">Loading members…</p>
                        ) : teamMembers.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No team members yet. Add staff by email above.</p>
                        ) : (
                          <ul className="space-y-2 rounded-md border">
                            {teamMembers.map((m) => (
                              <li
                                key={m.id}
                                className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                              >
                                <span className="truncate">{m.email}</span>
                                <span className="shrink-0 text-muted-foreground capitalize">{m.role}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="shrink-0"
                                  disabled={removingMemberId === m.id}
                                  onClick={async () => {
                                    setRemovingMemberId(m.id)
                                    try {
                                      const res = await fetch(`/api/venues/${venue.id}/members/${m.id}`, {
                                        method: "DELETE",
                                      })
                                      if (!res.ok) {
                                        showToast("Failed to remove member.", "error")
                                        return
                                      }
                                      fetchTeamMembers()
                                      showToast("Member removed.", "success")
                                    } finally {
                                      setRemovingMemberId(null)
                                    }
                                  }}
                                >
                                  <UserMinus className="h-4 w-4" />
                                </Button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </>
                )}
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

      {
        showStripe && (
          <Dialog open={isPayoutDialogOpen} onOpenChange={setIsPayoutDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request payout</DialogTitle>
                <DialogDescription>
                  Enter the amount you want to withdraw. Minimum payout is $5.00.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="payout-amount">
                  Amount (USD)
                </label>
                <input
                  id="payout-amount"
                  type="number"
                  min="5"
                  step="0.01"
                  value={payoutAmount}
                  onChange={(event) => setPayoutAmount(event.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="5.00"
                />
                {stripeBalance && (
                  <p className="text-xs text-muted-foreground">
                    Available: {formatMoney(stripeBalance.available, stripeBalance.currency)}
                  </p>
                )}
                {payoutError && (
                  <p className="text-xs text-red-600">{payoutError}</p>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsPayoutDialogOpen(false)}
                  disabled={isPayoutSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePayoutSubmit}
                  disabled={isPayoutSubmitting || !!payoutError}
                >
                  {isPayoutSubmitting ? "Submitting..." : "Submit payout"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )
      }

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

      {/* QR ready modal */}
      <Dialog
        open={printQRModal !== null}
        onOpenChange={(open) => !open && setPrintQRModal(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>QR ready</DialogTitle>
          </DialogHeader>
          {printQRModal && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <img
                  src={`/api/qr-assets/${printQRModal.token}/qr-only.svg`}
                  alt="QR preview"
                  className="h-24 w-24"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`/api/qr-assets/${printQRModal.token}/qr-only.svg`}
                    download="nooc-qr-only.svg"
                  >
                    Download QR only (SVG)
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`/api/qr-assets/${printQRModal.token}/sticker.svg`}
                    download="nooc-sticker.svg"
                  >
                    Download full sticker (SVG)
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <SignageOrderWizard
        venue={venue}
        open={signageOrderWizardOpen}
        onOpenChange={setSignageOrderWizardOpen}
        onSuccess={() => {
          showToast("Signage order submitted", "success")
          router.refresh()
        }}
      />

      {/* Signage order detail modal */}
      <Dialog open={!!selectedSignageOrder} onOpenChange={(open) => !open && setSelectedSignageOrder(null)}>
        <DialogContent className="sm:max-w-md">
          {selectedSignageOrder && (
            <>
              <DialogHeader>
                <DialogTitle>Signage order</DialogTitle>
                <DialogDescription>Shipping and line items for this order.</DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {selectedSignageOrder.status === "NEW"
                    ? "New"
                    : selectedSignageOrder.status === "IN_PRODUCTION"
                      ? "In production"
                      : selectedSignageOrder.status === "SHIPPED"
                        ? "Shipped"
                        : selectedSignageOrder.status === "DELIVERED"
                          ? "Delivered"
                          : selectedSignageOrder.status === "CANCELLED"
                            ? "Cancelled"
                            : selectedSignageOrder.status}
                </span>
              </div>
              <div className="space-y-4">
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-muted-foreground">Shipping</p>
                  <p>{selectedSignageOrder.contactName}</p>
                  <p className="text-muted-foreground">{selectedSignageOrder.contactEmail}</p>
                  {selectedSignageOrder.contactPhone && (
                    <p className="text-muted-foreground">{selectedSignageOrder.contactPhone}</p>
                  )}
                  <p className="text-muted-foreground">
                    {selectedSignageOrder.shipAddress1}
                    {selectedSignageOrder.shipAddress2 ? `, ${selectedSignageOrder.shipAddress2}` : ""}
                  </p>
                  <p className="text-muted-foreground">
                    {selectedSignageOrder.shipCity}, {selectedSignageOrder.shipState} {selectedSignageOrder.shipPostalCode}
                  </p>
                  <p className="text-muted-foreground">{selectedSignageOrder.shipCountry}</p>
                  {selectedSignageOrder.shippingNotes && (
                    <p className="text-muted-foreground pt-1">{selectedSignageOrder.shippingNotes}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="font-medium text-muted-foreground">Line items</p>
                  <ul className="space-y-2">
                    {selectedSignageOrder.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 rounded-md border bg-muted/30 p-2 text-sm"
                      >
                        <img
                          src={`/api/qr-assets/${item.qrAsset.token}/qr-only.svg`}
                          alt=""
                          className="h-12 w-12 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{item.label}</p>
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {item.qrScopeType}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                {(selectedSignageOrder.shippedAt ||
                  selectedSignageOrder.trackingCarrier ||
                  selectedSignageOrder.trackingNumber) && (
                    <div className="space-y-1 border-t pt-3 text-sm">
                      <p className="font-medium text-muted-foreground">Tracking</p>
                      {selectedSignageOrder.trackingCarrier && (
                        <p className="text-muted-foreground">{selectedSignageOrder.trackingCarrier}</p>
                      )}
                      {selectedSignageOrder.trackingNumber && (
                        <p className="text-muted-foreground">{selectedSignageOrder.trackingNumber}</p>
                      )}
                      {selectedSignageOrder.shippedAt && (
                        <p className="text-muted-foreground">
                          Shipped {new Date(selectedSignageOrder.shippedAt).toLocaleDateString("en-US")}
                        </p>
                      )}
                      {selectedSignageOrder.deliveredAt && (
                        <p className="text-muted-foreground">
                          Delivered {new Date(selectedSignageOrder.deliveredAt).toLocaleDateString("en-US")}
                        </p>
                      )}
                    </div>
                  )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Pause reservations modal */}
      <Dialog open={pauseModalOpen} onOpenChange={setPauseModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pause reservations</DialogTitle>
            <DialogDescription>
              New bookings will be blocked. Optionally add a message shown to users and cancel future reservations.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="pause-message">Pause message (optional)</Label>
              <Textarea
                id="pause-message"
                value={pauseMessageInput}
                onChange={(e) => setPauseMessageInput(e.target.value)}
                placeholder="e.g. Closed for renovations until next week"
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="cancel-future"
                checked={cancelFutureOnPause}
                onChange={(e) => setCancelFutureOnPause(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="cancel-future">Cancel all future reservations for this venue</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPauseModalOpen(false)} disabled={pauseUnpauseLoading}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                handlePause()
              }}
              disabled={pauseUnpauseLoading}
            >
              {pauseUnpauseLoading ? "Pausing…" : "Pause reservations"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete venue modal */}
      <Dialog open={deleteVenueModalOpen} onOpenChange={setDeleteVenueModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete venue</DialogTitle>
            <DialogDescription>
              This will remove the venue from listings and cancel all future reservations. Past reservations and data are preserved. Type the venue name or DELETE to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="delete-venue-confirmation">
                Type &quot;{venue.name}&quot; or DELETE to confirm
              </Label>
              <Input
                id="delete-venue-confirmation"
                value={deleteVenueConfirmation}
                onChange={(e) => setDeleteVenueConfirmation(e.target.value)}
                placeholder={venue.name ?? "DELETE"}
                className="font-mono"
                autoComplete="off"
              />
            </div>
            {deleteVenueError && (
              <p className="text-sm text-destructive">{deleteVenueError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteVenueModalOpen(false)} disabled={deleteVenueLoading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteVenue} disabled={deleteVenueLoading}>
              {deleteVenueLoading ? "Deleting…" : "Delete venue"}
            </Button>
          </DialogFooter>
        </DialogContent>
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

      {/* Seat/Table Detail Modal */}
      <Dialog open={!!selectedSeat} onOpenChange={(open) => !open && setSelectedSeat(null)}>
        {selectedSeat && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedSeat.isGroupTable ? "Table Details" : "Seat Details"}</DialogTitle>
              <DialogDescription>
                {selectedSeat.isGroupTable ? (
                  <>
                    {selectedSeat.tableName}
                    {(() => {
                      const table = venue.tables.find((t) => t.id === selectedSeat.tableId)
                      return table ? ` (${table.seats.length} ${table.seats.length === 1 ? "seat" : "seats"})` : ""
                    })()}
                  </>
                ) : (
                  <>
                    {getSeatLabel(
                      venue.tables
                        .flatMap((t) => t.seats)
                        .find((s) => s.id === selectedSeat.seatId)
                    )}{" "}
                    at {selectedSeat.tableName}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <SeatDetailView
              seatId={selectedSeat.seatId}
              tableId={selectedSeat.tableId}
              tableName={selectedSeat.tableName}
              isGroupTable={selectedSeat.isGroupTable || false}
              reservations={
                selectedSeat.isGroupTable
                  ? reservations.filter((r) => r.tableId === selectedSeat.tableId && r.seatId === null)
                  : reservations.filter((r) => r.seatId === selectedSeat.seatId)
              }
              seatBlocks={
                selectedSeat.isGroupTable
                  ? seatBlocks.filter((b) => {
                    // For group tables, show blocks for any seat in the table or venue-wide blocks
                    if (b.seatId === null) return true // Venue-wide block
                    const table = venue.tables.find((t) => t.id === selectedSeat.tableId)
                    return table?.seats.some((s) => s.id === b.seatId) || false
                  })
                  : seatBlocks.filter((b) => b.seatId === selectedSeat.seatId)
              }
              currentTime={currentTime}
              onBlock={() => {
                setSelectedSeat(null)
                setBlockingSeat({
                  seatId: selectedSeat.isGroupTable ? null : selectedSeat.seatId,
                  tableName: selectedSeat.tableName,
                })
              }}
              onUnblock={handleUnblockSeat}
              venueId={venue.id}
            />
          </DialogContent>
        )}
      </Dialog>

      {/* Deal Form Modal */}
      <DealForm
        open={dealFormOpen}
        onOpenChange={setDealFormOpen}
        venueId={venue.id}
        deal={editingDeal}
        onSuccess={handleDealFormSuccess}
      />
    </div >
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

// Seat/Table Detail View Component
function SeatDetailView({
  seatId,
  tableId,
  tableName,
  isGroupTable,
  reservations,
  seatBlocks,
  currentTime,
  onBlock,
  onUnblock,
  venueId,
}: {
  seatId: string
  tableId: string
  tableName: string
  isGroupTable: boolean
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
                    {isGroupTable && r.seatCount && (
                      <span className="ml-1">
                        · {r.seatCount} seat{r.seatCount > 1 ? "s" : ""}
                      </span>
                    )}
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
        {isGroupTable ? "Block this table" : "Block this seat"}
      </Button>
    </div>
  )
}
