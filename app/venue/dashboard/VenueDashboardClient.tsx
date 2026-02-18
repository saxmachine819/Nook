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
  pausedAt: string | null
}

function getStatusPill(status: string) {
  const config: Record<string, { label: string; className: string }> = {
    DRAFT: { label: "Draft", className: "bg-muted text-muted-foreground" },
    SUBMITTED: { label: "Pending Review", className: "bg-yellow-100 text-yellow-800" },
    APPROVED: { label: "Active", className: "bg-green-100 text-green-800" },
    REJECTED: { label: "Rejected", className: "bg-red-100 text-red-800" },
  }
  const { label, className } = config[status] || config.DRAFT
  return { label, className }
}

export function VenueDashboardClient() {
  const [venues, setVenues] = useState<Venue[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [userInfo, setUserInfo] = useState<{ id: string; email: string | null } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/users/me/venues", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { venues: [], isAdmin: false }))
      .then((data) => {
        const list = (data.venues ?? []) as Venue[]
        list.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" }))
        setVenues(list)
        setIsAdmin(data.isAdmin ?? false)
        if (data.userId) {
          setUserInfo({ id: data.userId, email: data.email ?? null })
        }
      })
      .catch(() => {
        setVenues([])
        setIsAdmin(false)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white">
      <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Venue Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Admin: showing all venues" : "Manage your venues"}
          </p>
          {userInfo && (
            <div className="mt-3 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <div>
                <span className="font-medium text-foreground text-xs uppercase tracking-wider opacity-70">User ID:</span> {userInfo.id}
              </div>
              {userInfo.email && (
                <div>
                  <span className="font-medium text-foreground text-xs uppercase tracking-wider opacity-70">Email:</span> {userInfo.email}
                </div>
              )}
            </div>
          )}
        </div>
        {!loading && (
          <Button asChild className="shrink-0">
            <Link href="/venue/onboard">
              <Plus className="mr-2 h-4 w-4" />
              Add venue
            </Link>
          </Button>
        )}
      </div>

      {loading ? (
        <Card className="border-muted/60 bg-white/90 shadow-sm">
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">Loading venues…</p>
          </CardContent>
        </Card>
      ) : venues.length > 0 ? (
        <div className="space-y-4">
          {venues.map((v) => (
            <Card key={v.id} className="border-muted/60 bg-white/90 shadow-sm">
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
                      if (v.pausedAt != null) {
                        return (
                          <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800">
                            Paused
                          </span>
                        )
                      }
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
        <Card className="border-muted/60 bg-white/90 shadow-sm">
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
    </div>
  )
}
