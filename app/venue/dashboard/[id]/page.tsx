import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditVenue } from "@/lib/venue-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { VenueOpsConsoleClient } from "./VenueOpsConsoleClient"
import { parseGooglePeriodsToVenueHours, syncVenueHoursFromGoogle } from "@/lib/venue-hours"

interface VenueOpsConsolePageProps {
  params: { id: string }
}

export default async function VenueOpsConsolePage({ params }: VenueOpsConsolePageProps) {
  const session = await auth()

  if (!session?.user?.id) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Venue Operations</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You must be signed in to access the venue operations console.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Fetch venue with tables and seats
  const venue = await prisma.venue.findUnique({
    where: { id: params.id },
    include: {
      tables: {
        include: {
          seats: {
            orderBy: {
              position: "asc",
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  })

  if (!venue) {
    notFound()
  }

  // Check authorization
  if (!canEditVenue(session.user, venue)) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Venue Operations</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Permission denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You don&apos;t have permission to access this venue&apos;s operations console.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const now = new Date()

  // Fetch reservations, seat blocks, deals, and QR assets
  const [reservations, seatBlocks, dealsResult, qrAssets] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        venueId: venue.id,
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
        seat: {
          include: {
            table: {
              select: {
                name: true,
              },
            },
          },
        },
        table: {
          select: {
            name: true,
            seatCount: true,
          },
        },
      },
      orderBy: {
        startAt: "asc",
      },
    }),
    prisma.seatBlock.findMany({
      where: {
        venueId: venue.id,
      },
      orderBy: {
        startAt: "asc",
      },
    }),
    prisma.deal.findMany({
      where: {
        venueId: venue.id,
      },
      orderBy: [
        { featured: "desc" },
        { createdAt: "desc" },
      ],
    }).catch((error) => {
      console.error("Error fetching deals:", error)
      return []
    }),
    prisma.qRAsset.findMany({
      where: {
        venueId: venue.id,
        status: "ACTIVE",
        resourceType: { not: null },
        resourceId: { not: null },
      },
      select: { resourceType: true, resourceId: true, token: true },
    }),
  ])

  const deals = dealsResult || []
  const assignedQrByResourceKey: Record<string, string> = {}
  for (const a of qrAssets || []) {
    if (!a.resourceType || !a.resourceId || !a.token) continue
    if (a.resourceType === "seat" || a.resourceType === "table") {
      assignedQrByResourceKey[`${a.resourceType}:${a.resourceId}`] = a.token
    }
  }

  // Backfill venue hours if needed (idempotent). Run when we have openingHoursJson.periods and
  // either no VenueHours or all VenueHours are google source (so we can repair missing/stale google rows).
  // syncVenueHoursFromGoogle respects hoursSource=manual and does not overwrite manual rows.
  if (venue.openingHoursJson) {
    try {
      const openingHours = venue.openingHoursJson as any
      if (openingHours.periods && Array.isArray(openingHours.periods) && openingHours.periods.length > 0) {
        const existingRows = await prisma.venueHours.findMany({
          where: { venueId: venue.id },
          select: { source: true },
        })
        const shouldSync =
          existingRows.length === 0 ||
          existingRows.every((r) => r.source === "google" || r.source == null)
        if (shouldSync) {
          const hoursData = parseGooglePeriodsToVenueHours(openingHours.periods, venue.id, "google")
          const hoursSource = (venue as { hoursSource?: string | null }).hoursSource ?? null
          await syncVenueHoursFromGoogle(prisma, venue.id, hoursData, hoursSource)
        }
      }
    } catch (error) {
      // Log error but don't fail page load
      console.error("Error backfilling venue hours:", error)
    }
  }

  return (
    <VenueOpsConsoleClient
      venue={venue}
      reservations={reservations}
      seatBlocks={seatBlocks}
      deals={deals}
      now={now.toISOString()}
      assignedQrByResourceKey={assignedQrByResourceKey}
    />
  )
}
