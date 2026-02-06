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
        { error: "You must be signed in to reassign venue owner." },
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

    // Get ownerEmail from request body
    const body = await request.json().catch(() => ({}))
    const ownerEmail = body.ownerEmail?.trim()

    if (!ownerEmail) {
      return NextResponse.json(
        { error: "ownerEmail is required" },
        { status: 400 }
      )
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(ownerEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      )
    }

    // Verify venue exists
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, name: true },
    })

    if (!venue) {
      return NextResponse.json(
        { error: "Venue not found." },
        { status: 404 }
      )
    }

    // Find user by email
    const newOwner = await prisma.user.findUnique({
      where: { email: ownerEmail },
      select: { id: true, email: true, name: true },
    })

    if (!newOwner) {
      return NextResponse.json(
        { error: `User with email "${ownerEmail}" not found.` },
        { status: 404 }
      )
    }

    // Update venue owner
    const updatedVenue = await prisma.venue.update({
      where: { id: venueId },
      data: {
        ownerId: newOwner.id,
      },
      select: {
        id: true,
        name: true,
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json(
      {
        venue: {
          id: updatedVenue.id,
          name: updatedVenue.name,
          ownerEmail: updatedVenue.owner?.email || null,
          ownerName: updatedVenue.owner?.name || null,
        },
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error("Error reassigning venue owner:", error)
    
    const errorMessage = error?.message || "Failed to reassign venue owner. Please try again."
    
    return NextResponse.json(
      { error: errorMessage, details: process.env.NODE_ENV === "development" ? error?.message : undefined },
      { status: 500 }
    )
  }
}
