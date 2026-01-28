import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  request: Request,
  context: { params: Promise<{ venueId: string }> }
) {
  try {
    const params = await context.params
    const venueId = params.venueId

    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to favorite venues." },
        { status: 401 }
      )
    }

    // Verify venue exists
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
    })

    if (!venue) {
      return NextResponse.json(
        { error: "Venue not found." },
        { status: 404 }
      )
    }

    // Check if favorite already exists
    const existing = await prisma.favoriteVenue.findUnique({
      where: {
        userId_venueId: {
          userId: session.user.id,
          venueId: venueId,
        },
      },
    })

    let favorited: boolean

    if (existing) {
      // Unfavorite: Delete FavoriteVenue and cascade delete related favorites
      await prisma.$transaction(async (tx) => {
        // Delete FavoriteVenue
        await tx.favoriteVenue.delete({
          where: {
            userId_venueId: {
              userId: session.user.id,
              venueId: venueId,
            },
          },
        })

        // Delete all FavoriteTable records for this user+venue
        await tx.favoriteTable.deleteMany({
          where: {
            userId: session.user.id,
            venueId: venueId,
          },
        })

        // Delete all FavoriteSeat records for this user+venue
        await tx.favoriteSeat.deleteMany({
          where: {
            userId: session.user.id,
            venueId: venueId,
          },
        })
      })
      favorited = false
    } else {
      // Favorite: Create FavoriteVenue
      await prisma.favoriteVenue.create({
        data: {
          userId: session.user.id,
          venueId: venueId,
        },
      })
      favorited = true
    }

    return NextResponse.json({ favorited })
  } catch (error) {
    console.error("Error toggling venue favorite:", error)
    return NextResponse.json(
      { error: "Failed to toggle venue favorite." },
      { status: 500 }
    )
  }
}
