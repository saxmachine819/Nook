"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle, Clock, Image, Calendar, Users, DollarSign, FileText, Gift, Loader2, Eye, CreditCard } from "lucide-react"
import Link from "next/link"
import { RejectionDialog } from "@/components/admin/RejectionDialog"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

interface ReadinessIndicators {
  hasPhotos: boolean
  hasHours: boolean
  hasSeats: boolean
  hasPricing: boolean
  hasRules: boolean
  hasDeals: boolean
  stripeApproved: boolean
}

interface Venue {
  id: string
  name: string
  address: string | null
  ownerEmail: string | null
  ownerName: string | null
  submittedAt: Date | string | null
  readiness: ReadinessIndicators
}

interface ApprovalsClientProps {
  initialVenues: Venue[]
}

export function ApprovalsClient({ initialVenues }: ApprovalsClientProps) {
  const router = useRouter()
  const { showToast, ToastComponent } = useToast()
  const [venues, setVenues] = useState<Venue[]>(initialVenues)
  const [loadingState, setLoadingState] = useState<{
    venueId: string
    action: "approve" | "reject" | "sendToDraft"
  } | null>(null)
  const [rejectionDialog, setRejectionDialog] = useState<{
    open: boolean
    venue: Venue | null
  }>({ open: false, venue: null })

  const handleApprove = async (venue: Venue) => {
    setLoadingState({ venueId: venue.id, action: "approve" })
    try {
      const response = await fetch(`/api/venues/${venue.id}/approve`, {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        showToast(data.error || "Failed to approve venue", "error")
        return
      }

      // Optimistically remove from queue
      setVenues((prev) => prev.filter((v) => v.id !== venue.id))
      showToast("Venue approved", "success")
      
      // Refresh the page data
      router.refresh()
    } catch (error) {
      console.error("Error approving venue:", error)
      showToast("Failed to approve venue", "error")
    } finally {
      setLoadingState(null)
    }
  }

  const handleReject = async (venue: Venue, reason: string) => {
    setLoadingState({ venueId: venue.id, action: "reject" })
    try {
      const response = await fetch(`/api/venues/${venue.id}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rejectionReason: reason }),
      })

      const data = await response.json()

      if (!response.ok) {
        showToast(data.error || "Failed to reject venue", "error")
        return
      }

      // Optimistically remove from queue
      setVenues((prev) => prev.filter((v) => v.id !== venue.id))
      showToast("Venue rejected", "success")
      
      // Refresh the page data
      router.refresh()
    } catch (error) {
      console.error("Error rejecting venue:", error)
      showToast("Failed to reject venue", "error")
    } finally {
      setLoadingState(null)
    }
  }

  const handleSendToDraft = async (venue: Venue) => {
    setLoadingState({ venueId: venue.id, action: "sendToDraft" })
    try {
      const response = await fetch(`/api/venues/${venue.id}/send-to-draft`, {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        showToast(data.error || "Failed to send venue to draft", "error")
        return
      }

      // Optimistically remove from queue
      setVenues((prev) => prev.filter((v) => v.id !== venue.id))
      showToast("Venue sent back to draft", "success")
      
      // Refresh the page data
      router.refresh()
    } catch (error) {
      console.error("Error sending venue to draft:", error)
      showToast("Failed to send venue to draft", "error")
    } finally {
      setLoadingState(null)
    }
  }

  const formatDate = (date: Date | string | null) => {
    if (!date) return "N/A"
    const dateObj = typeof date === "string" ? new Date(date) : date
    return dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const ReadinessIndicator = ({
    label,
    hasValue,
    icon: Icon,
  }: {
    label: string
    hasValue: boolean
    icon: React.ElementType
  }) => (
    <div className="flex items-center gap-2 text-sm">
      {hasValue ? (
        <CheckCircle2 className="h-4 w-4 text-green-600" />
      ) : (
        <XCircle className="h-4 w-4 text-muted-foreground" />
      )}
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className={cn("text-muted-foreground", hasValue && "text-foreground")}>
        {label}
      </span>
    </div>
  )

  if (venues.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>No pending approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              There are no venues waiting for approval.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {venues.map((venue) => {
          const isLoading = loadingState?.venueId === venue.id
          const isApproving = loadingState?.venueId === venue.id && loadingState?.action === "approve"
          const isRejecting = loadingState?.venueId === venue.id && loadingState?.action === "reject"
          const isSendingToDraft = loadingState?.venueId === venue.id && loadingState?.action === "sendToDraft"
          const { readiness } = venue

          return (
            <Card key={venue.id} className="transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{venue.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{venue.address}</p>
                    {venue.ownerEmail && (
                      <p className="text-xs text-muted-foreground">
                        Owner: {venue.ownerName || venue.ownerEmail}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Submitted: {formatDate(venue.submittedAt)}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Readiness Indicators */}
                  <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/50 p-3">
                    <ReadinessIndicator
                      label="Photos"
                      hasValue={readiness.hasPhotos}
                      icon={Image}
                    />
                    <ReadinessIndicator
                      label="Hours"
                      hasValue={readiness.hasHours}
                      icon={Calendar}
                    />
                    <ReadinessIndicator
                      label="Seats"
                      hasValue={readiness.hasSeats}
                      icon={Users}
                    />
                    <ReadinessIndicator
                      label="Pricing"
                      hasValue={readiness.hasPricing}
                      icon={DollarSign}
                    />
                    <ReadinessIndicator
                      label="Rules"
                      hasValue={readiness.hasRules}
                      icon={FileText}
                    />
                    <ReadinessIndicator
                      label="Deals"
                      hasValue={readiness.hasDeals}
                      icon={Gift}
                    />
                    <ReadinessIndicator
                      label="Stripe Approved?"
                      hasValue={readiness.stripeApproved}
                      icon={CreditCard}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      asChild
                      variant="outline"
                      className="flex-1 min-w-[120px]"
                    >
                      <Link href={`/venue/${venue.id}?returnTo=/admin/approvals`} className="flex items-center justify-center">
                        <Eye className="mr-2 h-4 w-4" />
                        View Venue
                      </Link>
                    </Button>
                    <Button
                      onClick={() => handleApprove(venue)}
                      disabled={isLoading || !readiness.stripeApproved}
                      title={!readiness.stripeApproved ? "Connect Stripe and complete onboarding before this venue can be approved." : undefined}
                      className="flex-1 min-w-[120px]"
                    >
                      {isApproving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Approving...
                        </>
                      ) : (
                        "Approve"
                      )}
                    </Button>
                    <Button
                      onClick={() =>
                        setRejectionDialog({ open: true, venue })
                      }
                      disabled={isLoading}
                      variant="destructive"
                      className="flex-1 min-w-[120px]"
                    >
                      {isRejecting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Rejecting...
                        </>
                      ) : (
                        "Reject"
                      )}
                    </Button>
                    <Button
                      onClick={() => handleSendToDraft(venue)}
                      disabled={isLoading}
                      variant="outline"
                      className="flex-1 min-w-[120px]"
                    >
                      {isSendingToDraft ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Send to Draft"
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {rejectionDialog.venue && (
        <RejectionDialog
          open={rejectionDialog.open}
          onOpenChange={(open) =>
            setRejectionDialog({ open, venue: open ? rejectionDialog.venue : null })
          }
          onConfirm={(reason) => handleReject(rejectionDialog.venue!, reason)}
          venueName={rejectionDialog.venue.name}
        />
      )}

      {ToastComponent}
    </>
  )
}
