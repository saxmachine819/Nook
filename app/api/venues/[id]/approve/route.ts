import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/venue-auth"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const venueId = params.id

    // Require authentication
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to approve a venue." },
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

    // Verify venue exists and is in SUBMITTED status
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, onboardingStatus: true },
    })

    if (!venue) {
      return NextResponse.json(
        { error: "Venue not found." },
        { status: 404 }
      )
    }

    if (venue.onboardingStatus !== "SUBMITTED") {
      return NextResponse.json(
        { error: `Venue cannot be approved. Current status: ${venue.onboardingStatus}` },
        { status: 400 }
      )
    }

    // Update venue to APPROVED
    const updatedVenue = await prisma.venue.update({
      where: { id: venueId },
      data: {
        onboardingStatus: "APPROVED",
        approvedAt: new Date(),
        approvedByUserId: session.user.id,
        rejectedAt: null,
        rejectionReason: null,
        rejectedByUserId: null,
      },
      select: { id: true, name: true, onboardingStatus: true },
    })

    return NextResponse.json({ venue: updatedVenue }, { status: 200 })
  } catch (error: any) {
    console.error("Error approving venue:", error)
    
    const errorMessage = error?.message || "Failed to approve venue. Please try again."
    
    return NextResponse.json(
      { error: errorMessage, details: process.env.NODE_ENV === "development" ? error?.message : undefined },
      { status: 500 }
    )
  }
}
