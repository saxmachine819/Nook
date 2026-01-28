"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Search, X, Building2, Mail, Clock, Eye, Edit, UserCog } from "lucide-react"
import { ReassignOwnerDialog } from "@/components/admin/ReassignOwnerDialog"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface VenueListItem {
  id: string
  name: string
  address: string | null
  onboardingStatus: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED"
  createdAt: Date | string
  ownerEmail: string | null
  ownerName: string | null
}

interface VenuesClientProps {
  initialVenues: VenueListItem[]
  initialSearchQuery: string
}

export function VenuesClient({ initialVenues, initialSearchQuery }: VenuesClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [venues, setVenues] = useState<VenueListItem[]>(initialVenues)
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [reassignDialog, setReassignDialog] = useState<{
    open: boolean
    venue: VenueListItem | null
  }>({ open: false, venue: null })
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Sync venues with initialVenues prop when it changes (from server re-render)
  useEffect(() => {
    setVenues(initialVenues)
  }, [initialVenues])

  // Update search query in URL
  const updateSearch = (query: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (query.trim()) {
      params.set("search", query.trim())
    } else {
      params.delete("search")
    }
    router.push(`/admin/venues?${params.toString()}`)
  }

  // Debounce search (only if search query actually changed from initial)
  useEffect(() => {
    // Don't trigger search on initial mount if query matches initial
    if (searchQuery === initialSearchQuery) {
      return
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      updateSearch(searchQuery)
    }, 300)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [searchQuery, initialSearchQuery])

  const formatDate = (date: Date | string | null) => {
    if (!date) return "N/A"
    const dateObj = typeof date === "string" ? new Date(date) : date
    return dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const handleClearSearch = () => {
    setSearchQuery("")
    updateSearch("")
  }

  const getStatusBadgeClass = (status: string) => {
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

  const handleReassignSuccess = () => {
    // Refresh the page to get updated venue data
    router.refresh()
  }

  if (venues.length === 0) {
    return (
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or address..."
            className="w-full rounded-md border border-input bg-background px-10 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>No venues found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {searchQuery ? "No venues match your search." : "There are no venues in the system."}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or address..."
            className="w-full rounded-md border border-input bg-background px-10 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Venues List */}
        <div className="space-y-2">
          {/* Column Headers - Hidden on mobile, shown on desktop */}
          <div className="hidden md:grid md:grid-cols-6 gap-4 px-4 py-2 border-b text-xs font-medium text-muted-foreground">
            <div>Name</div>
            <div>Address</div>
            <div>Status</div>
            <div>Owner</div>
            <div>Created</div>
            <div>Actions</div>
          </div>

          {/* Venue Rows */}
          {venues.map((venue) => (
            <Card key={venue.id} className="transition-colors">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-6 md:items-center">
                  {/* Name */}
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{venue.name}</p>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="text-sm text-muted-foreground">
                    {venue.address || "No address"}
                  </div>

                  {/* Status */}
                  <div>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                        getStatusBadgeClass(venue.onboardingStatus)
                      )}
                    >
                      {venue.onboardingStatus}
                    </span>
                  </div>

                  {/* Owner */}
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {venue.ownerEmail || "No owner"}
                    </span>
                  </div>

                  {/* Created At */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {formatDate(venue.createdAt)}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/venue/${venue.id}?returnTo=/admin/venues`} className="flex items-center justify-center">
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/venue/dashboard/${venue.id}/edit?returnTo=/admin/venues`} className="flex items-center justify-center">
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReassignDialog({ open: true, venue })}
                      className="flex items-center justify-center"
                    >
                      <UserCog className="mr-2 h-4 w-4" />
                      Reassign
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {reassignDialog.venue && (
        <ReassignOwnerDialog
          open={reassignDialog.open}
          onOpenChange={(open) =>
            setReassignDialog({ open, venue: open ? reassignDialog.venue : null })
          }
          venueId={reassignDialog.venue.id}
          venueName={reassignDialog.venue.name}
          currentOwnerEmail={reassignDialog.venue.ownerEmail}
          onSuccess={handleReassignSuccess}
        />
      )}
    </>
  )
}
