import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/venue-auth"

interface ReadinessIndicators {
  hasPhotos: boolean
  hasHours: boolean
  hasSeats: boolean
  hasPricing: boolean
  hasRules: boolean
  hasDeals: boolean
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
  }
}

export async function GET() {
  try {
    // Require authentication
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to view approvals." },
        { status: 401 }
      )
    }

    // Check admin access
    if (!isAdmin(session.user)) {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 403 }
      )
    }

    // Fetch venues with SUBMITTED status, ordered by submittedAt DESC
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

    // Compute readiness indicators for each venue
    const venuesWithIndicators = venues.map((venue) => ({
      id: venue.id,
      name: venue.name,
      address: venue.address,
      ownerEmail: venue.owner?.email || null,
      ownerName: venue.owner?.name || null,
      submittedAt: venue.submittedAt,
      readiness: computeReadinessIndicators(venue),
    }))

    return NextResponse.json({ venues: venuesWithIndicators }, { status: 200 })
  } catch (error: any) {
    console.error("Error fetching submitted venues:", error)
    
    const errorMessage = error?.message || "Failed to fetch submitted venues. Please try again."
    
    return NextResponse.json(
      { error: errorMessage, details: process.env.NODE_ENV === "development" ? error?.message : undefined },
      { status: 500 }
    )
  }
}
