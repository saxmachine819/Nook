"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Building2, Calendar, Clock, Mail, User as UserIcon, Loader2 } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface UserDetailModalProps {
  userId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface UserDetail {
  id: string
  name: string | null
  email: string | null
  createdAt: Date | string | null
  isAdmin: boolean
  venues: Array<{
    id: string
    name: string
    address: string | null
    onboardingStatus: string
  }>
  reservations: Array<{
    id: string
    venueId: string
    venueName: string
    startAt: Date | string
    endAt: Date | string
    seatCount: number
    status: string
  }>
}

export function UserDetailModal({ userId, open, onOpenChange }: UserDetailModalProps) {
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && userId) {
      fetchUserDetail()
    } else {
      setUserDetail(null)
      setError(null)
    }
  }, [open, userId])

  const fetchUserDetail = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/users/${userId}`)
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to load user details")
        return
      }

      setUserDetail(data.user)
    } catch (error) {
      console.error("Error fetching user detail:", error)
      setError("Failed to load user details")
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === "string" ? new Date(date) : date
    return dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const formatDateTime = (date: Date | string) => {
    const dateObj = typeof date === "string" ? new Date(date) : date
    return dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatTimeRange = (startAt: Date | string, endAt: Date | string) => {
    const start = typeof startAt === "string" ? new Date(startAt) : startAt
    const end = typeof endAt === "string" ? new Date(endAt) : endAt
    const startTime = start.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })
    const endTime = end.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })
    return `${formatDate(start)} ${startTime} - ${endTime}`
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getOnboardingStatusBadgeClass = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "bg-green-100 text-green-800"
      case "SUBMITTED":
        return "bg-yellow-100 text-yellow-800"
      case "REJECTED":
        return "bg-red-100 text-red-800"
      case "DRAFT":
        return "bg-muted text-muted-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="py-12 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={fetchUserDetail} variant="outline" className="mt-4">
              Retry
            </Button>
          </div>
        ) : userDetail ? (
          <>
            <DialogHeader>
              <DialogTitle>User Details</DialogTitle>
              <DialogDescription>
                View user information, venues owned, and recent reservations
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* User Info */}
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{userDetail.name || "No name"}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {userDetail.email || "No email"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      Joined: {userDetail.createdAt ? formatDate(userDetail.createdAt) : "Unknown"}
                    </div>
                    {userDetail.isAdmin && (
                      <div>
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                          Admin
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Venues Owned */}
              <div>
                <h3 className="mb-3 text-sm font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Venues Owned ({userDetail.venues.length})
                </h3>
                {userDetail.venues.length === 0 ? (
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">No venues owned</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {userDetail.venues.map((venue) => (
                      <Card key={venue.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{venue.name}</p>
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                    getOnboardingStatusBadgeClass(venue.onboardingStatus)
                                  )}
                                >
                                  {venue.onboardingStatus}
                                </span>
                              </div>
                              {venue.address && (
                                <p className="mt-1 text-sm text-muted-foreground">{venue.address}</p>
                              )}
                            </div>
                            {venue.onboardingStatus === "APPROVED" && (
                              <Button asChild variant="outline" size="sm">
                                <Link href={`/venue/${venue.id}?returnTo=/admin/users`}>
                                  View
                                </Link>
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Reservations */}
              <div>
                <h3 className="mb-3 text-sm font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Recent Reservations ({userDetail.reservations.length})
                </h3>
                {userDetail.reservations.length === 0 ? (
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">No reservations</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {userDetail.reservations.map((reservation) => (
                      <Card key={reservation.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium">{reservation.venueName}</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {formatTimeRange(reservation.startAt, reservation.endAt)}
                              </p>
                              <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                                <span>{reservation.seatCount} seat{reservation.seatCount !== 1 ? "s" : ""}</span>
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded-full px-2 py-0.5 font-medium",
                                    getStatusBadgeClass(reservation.status)
                                  )}
                                >
                                  {reservation.status}
                                </span>
                              </div>
                            </div>
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/reservations/${reservation.id}?returnTo=/admin/users`}>
                                View
                              </Link>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
