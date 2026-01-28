import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  request: Request,
  context: { params: Promise<{ seatId: string }> }
) {
  try {
    const params = await context.params
    const seatId = params.seatId

    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to favorite seats." },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { venueId } = body as { venueId?: string }

    if (!venueId) {
      return NextResponse.json(
        { error: "Missing required field: venueId." },
        { status: 400 }
      )
    }

    // Fetch seat with table and venue to validate ownership
    const seat = await prisma.seat.findUnique({
      where: { id: seatId },
      include: {
        table: {
          include: {
            venue: true,
          },
        },
      },
    })

    if (!seat) {
      return NextResponse.json(
        { error: "Seat not found." },
        { status: 404 }
      )
    }

    // Validate seat belongs to table, and table belongs to venueId
    if (seat.table.venueId !== venueId) {
      return NextResponse.json(
        { error: "Seat does not belong to this venue." },
        { status: 400 }
      )
    }

    // Check if favorite already exists
    const existing = await prisma.favoriteSeat.findUnique({
      where: {
        userId_seatId: {
          userId: session.user.id,
          seatId: seatId,
        },
      },
    })

    let favorited: boolean

    if (existing) {
      // Unfavorite: Delete FavoriteSeat
      await prisma.favoriteSeat.delete({
        where: {
          userId_seatId: {
            userId: session.user.id,
            seatId: seatId,
          },
        },
      })
      favorited = false
    } else {
      // Favorite: Create FavoriteSeat and ensure FavoriteVenue exists
      await prisma.$transaction(async (tx) => {
        // Upsert FavoriteSeat
        await tx.favoriteSeat.create({
          data: {
            userId: session.user.id,
            seatId: seatId,
            venueId: venueId,
          },
        })

        // Upsert FavoriteVenue to ensure venue is favorited
        await tx.favoriteVenue.upsert({
          where: {
            userId_venueId: {
              userId: session.user.id,
              venueId: venueId,
            },
          },
          create: {
            userId: session.user.id,
            venueId: venueId,
          },
          update: {},
        })
      })
      favorited = true
    }

    return NextResponse.json({ favorited })
  } catch (error) {
    console.error("Error toggling seat favorite:", error)
    return NextResponse.json(
      { error: "Failed to toggle seat favorite." },
      { status: 500 }
    )
  }
}
