"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, ExternalLink, Pencil, Settings } from "lucide-react"

interface Venue {
  id: string
  name: string
  address: string
  thumbnail: string | null
  onboardingStatus: string
}

function getStatusPill(status: string) {
  const config: Record<string, { label: string; className: string }> = {
    DRAFT: { label: "Draft", className: "bg-muted text-muted-foreground" },
    SUBMITTED: { label: "Pending Review", className: "bg-yellow-100 text-yellow-800" },
    APPROVED: { label: "Approved", className: "bg-green-100 text-green-800" },
    REJECTED: { label: "Rejected", className: "bg-red-100 text-red-800" },
  }
  const { label, className } = config[status] || config.DRAFT
  return { label, className }
}

export function VenueDashboardClient() {
  const [venues, setVenues] = useState<Venue[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/users/me/venues")
      .then((r) => (r.ok ? r.json() : { venues: [], isAdmin: false }))
      .then((data) => {
        setVenues(data.venues ?? [])
        setIsAdmin(data.isAdmin ?? false)
      })
      .catch(() => {
        setVenues([])
        setIsAdmin(false)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Venue Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAdmin ? "Admin: showing all venues" : "Manage your venues"}
        </p>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">Loading venues…</p>
          </CardContent>
        </Card>
      ) : venues.length > 0 ? (
        <div className="space-y-4">
          {venues.map((v) => (
            <Card key={v.id}>
              <div className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex flex-1 gap-3 sm:gap-4">
                  <div className="h-16 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                    {v.thumbnail ? (
                      <img
                        src={v.thumbnail}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-medium">{v.name}</p>
                    <p className="line-clamp-1 text-sm text-muted-foreground">
                      {v.address || "No address"}
                    </p>
                    {(() => {
                      const { label, className } = getStatusPill(v.onboardingStatus)
                      return (
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
                          {label}
                        </span>
                      )
                    })()}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/venue/${v.id}`}>
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      View
                    </Link>
                  </Button>
                  {v.onboardingStatus === "DRAFT" ? (
                    <Button size="sm" asChild>
                      <Link href={`/venue/onboard/stripe?venueId=${v.id}`}>
                        Continue onboarding
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/venue/dashboard/${v.id}/edit`}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Edit
                      </Link>
                    </Button>
                  )}
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/venue/dashboard/${v.id}`}>
                      <Settings className="mr-1.5 h-3.5 w-3.5" />
                      Manage
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Get started</CardTitle>
            <CardDescription>
              Add a venue to start accepting reservations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="lg" asChild>
              <Link href="/venue/onboard">
                <Plus className="mr-2 h-4 w-4" />
                Add a venue
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
