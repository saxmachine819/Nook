import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { VenueOpsConsoleClient } from "./VenueOpsConsoleClient"
import { parseGooglePeriodsToVenueHours, syncVenueHoursFromGoogle } from "@/lib/venue-hours"

interface VenueOpsConsolePageProps {
  params: Promise<{ id: string }>
}

export default async function VenueOpsConsolePage({ params }: VenueOpsConsolePageProps) {
  const { id: venueId } = await params

  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
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

  const now = new Date()

  // Fetch reservations, seat blocks, deals, QR assets (seat/table), venue-level QR, and last 5 signage orders
  const [reservations, seatBlocks, dealsResult, qrAssets, venueQrAsset, signageOrders] = await Promise.all([
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
    prisma.qRAsset.findFirst({
      where: {
        venueId: venue.id,
        status: "ACTIVE",
        resourceType: "venue",
        resourceId: null,
      },
      select: { token: true },
    }),
    prisma.signageOrder.findMany({
      where: { venueId: venue.id },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        template: { select: { name: true } },
        items: {
          include: {
            qrAsset: { select: { token: true } },
          },
        },
      },
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

  const venueQrToken = venueQrAsset?.token ?? null
  const incompleteSignageOrders = signageOrders.filter(
    (o) => o.status !== "DELIVERED" && o.status !== "CANCELLED"
  )

  return (
    <VenueOpsConsoleClient
      venue={venue}
      reservations={reservations}
      seatBlocks={seatBlocks}
      deals={deals}
      now={now.toISOString()}
      assignedQrByResourceKey={assignedQrByResourceKey}
      venueQrToken={venueQrToken}
      signageOrders={incompleteSignageOrders}
    />
  )
}
