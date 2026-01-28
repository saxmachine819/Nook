import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/venue-auth"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const userId = params.id

    // Require authentication
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to view user details." },
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

    // Fetch user with venues and recent reservations
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        venues: {
          select: {
            id: true,
            name: true,
            address: true,
            onboardingStatus: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        reservations: {
          include: {
            venue: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 10,
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      )
    }

    // Transform reservations to include venue name
    const reservations = user.reservations.map((reservation) => ({
      id: reservation.id,
      venueId: reservation.venueId,
      venueName: reservation.venue.name,
      startAt: reservation.startAt,
      endAt: reservation.endAt,
      seatCount: reservation.seatCount,
      status: reservation.status,
    }))

    return NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
          isAdmin: isAdmin(user),
          venues: user.venues,
          reservations,
        },
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error("Error fetching user detail:", error)
    
    const errorMessage = error?.message || "Failed to fetch user details. Please try again."
    
    return NextResponse.json(
      { error: errorMessage, details: process.env.NODE_ENV === "development" ? error?.message : undefined },
      { status: 500 }
    )
  }
}
