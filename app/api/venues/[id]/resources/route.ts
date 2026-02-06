import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditVenue, isAdmin } from "@/lib/venue-auth"
import { getVenueResources } from "@/lib/qr-asset-utils"

export async function GET(
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
        { error: "You must be signed in to view venue resources." },
        { status: 401 }
      )
    }

    // Verify venue exists
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: {
        id: true,
        ownerId: true,
      },
    })

    if (!venue) {
      return NextResponse.json(
        { error: "Venue not found" },
        { status: 404 }
      )
    }

    // Verify user has permission to manage this venue
    if (!isAdmin(session.user) && !canEditVenue(session.user, venue)) {
      return NextResponse.json(
        { error: "You do not have permission to view this venue's resources" },
        { status: 403 }
      )
    }

    // Fetch venue resources
    const resources = await getVenueResources(venueId)

    return NextResponse.json(resources, { status: 200 })
  } catch (error: any) {
    console.error("Error fetching venue resources:", error)

    const errorMessage =
      error?.message || "Failed to fetch venue resources. Please try again."

    return NextResponse.json(
      {
        error: errorMessage,
        details:
          process.env.NODE_ENV === "development" ? error?.message : undefined,
      },
      { status: 500 }
    )
  }
}
