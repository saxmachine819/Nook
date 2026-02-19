import React from "react"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/venue-auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"
import { ApprovalsClient } from "./ApprovalsClient"

interface ReadinessIndicators {
  hasPhotos: boolean
  hasHours: boolean
  hasSeats: boolean
  hasPricing: boolean
  hasRules: boolean
  hasDeals: boolean
  stripeApproved: boolean
}

function computeReadinessIndicators(venue: any): ReadinessIndicators {
  const hasPhotos = !!(
    venue.heroImageUrl ||
    (venue.imageUrls && Array.isArray(venue.imageUrls) && venue.imageUrls.length > 0)
  )

  const hasHours = venue.venueHours.length > 0 || !!venue.openingHoursJson

  const hasSeats = venue.tables.some((t: any) => t.seats.length > 0)

  const hasPricing = venue.tables.some(
    (t: any) =>
      t.seats.some((s: any) => s.pricePerHour > 0) ||
      (t.bookingMode === "group" && t.tablePricePerHour && t.tablePricePerHour > 0)
  )

  const hasRules = !!venue.rulesText

  const hasDeals = venue.deals.some((d: any) => d.isActive)

  return {
    hasPhotos,
    hasHours,
    hasSeats,
    hasPricing,
    hasRules,
    hasDeals,
    stripeApproved: false, // set per-venue in getSubmittedVenues after Stripe lookup
  }
}

async function getSubmittedVenues() {
  try {
    const venues = await prisma.venue.findMany({
      where: {
        onboardingStatus: "SUBMITTED",
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        tables: {
          include: {
            seats: true,
          },
        },
        venueHours: true,
        deals: {
          where: {
            isActive: true,
          },
        },
      },
      orderBy: {
        submittedAt: "desc",
      },
    })

    const venuesWithStripe = await Promise.all(
      venues.map(async (venue) => {
        const readiness = computeReadinessIndicators(venue)
        let stripeApproved = false
        if (venue.stripeAccountId) {
          try {
            const account = await stripe.accounts.retrieve(venue.stripeAccountId)
            stripeApproved = account.charges_enabled === true
          } catch {
            stripeApproved = false
          }
        }
        return {
          id: venue.id,
          name: venue.name,
          address: venue.address,
          ownerEmail: venue.owner?.email || null,
          ownerName: venue.owner?.name || null,
          submittedAt: venue.submittedAt ? new Date(venue.submittedAt) : null,
          readiness: { ...readiness, stripeApproved },
        }
      })
    )
    return venuesWithStripe
  } catch (error) {
    console.error("Error fetching submitted venues:", error)
    return []
  }
}

export default async function AdminApprovalsPage() {
  const session = await auth()

  // Check if user is authenticated and is an admin
  if (!session?.user || !isAdmin(session.user)) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Not authorized</CardTitle>
              <CardDescription>
                You do not have permission to access this page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/">Go to Home</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Fetch submitted venues
  const venues = await getSubmittedVenues()

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Venue Approvals</h1>
            <p className="text-sm text-muted-foreground">
              Review and approve venue submissions
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin">Back to Admin</Link>
          </Button>
        </div>
      </div>

      <ApprovalsClient initialVenues={venues} />
    </div>
  )
}
