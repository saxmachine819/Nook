import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditVenue } from "@/lib/venue-auth"

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const venueId = params.id

    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch venue to check authorization
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, ownerId: true },
    })

    if (!venue) {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 })
    }

    if (!canEditVenue(session.user, venue)) {
      return NextResponse.json(
        { error: "You don't have permission to view this venue's reservations." },
        { status: 403 }
      )
    }

    const now = new Date()

    // Fetch all reservations for the venue
    const reservations = await prisma.reservation.findMany({
      where: {
        venueId,
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
          },
        },
      },
      orderBy: {
        startAt: "asc",
      },
    })

    // Fetch all seat blocks for the venue
    const seatBlocks = await prisma.seatBlock.findMany({
      where: {
        venueId,
      },
      orderBy: {
        startAt: "asc",
      },
    })

    return NextResponse.json({
      reservations,
      seatBlocks,
      now: now.toISOString(),
    })
  } catch (error) {
    console.error("Error fetching venue reservations:", error)
    return NextResponse.json(
      { error: "Failed to fetch reservations." },
      { status: 500 }
    )
  }
}
