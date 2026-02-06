import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  request: Request,
  context: { params: Promise<{ tableId: string }> }
) {
  try {
    const params = await context.params
    const tableId = params.tableId

    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to favorite tables." },
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

    // Fetch table with venue to validate ownership
    const table = await prisma.table.findUnique({
      where: { id: tableId },
      include: {
        venue: true,
      },
    })

    if (!table) {
      return NextResponse.json(
        { error: "Table not found." },
        { status: 404 }
      )
    }

    // Validate table belongs to venueId
    if (table.venueId !== venueId) {
      return NextResponse.json(
        { error: "Table does not belong to this venue." },
        { status: 400 }
      )
    }

    // Check if favorite already exists
    const existing = await prisma.favoriteTable.findUnique({
      where: {
        userId_tableId: {
          userId: session.user.id,
          tableId: tableId,
        },
      },
    })

    let favorited: boolean

    if (existing) {
      // Unfavorite: Delete FavoriteTable
      await prisma.favoriteTable.delete({
        where: {
          userId_tableId: {
            userId: session.user.id,
            tableId: tableId,
          },
        },
      })
      favorited = false
    } else {
      // Favorite: Create FavoriteTable and ensure FavoriteVenue exists
      await prisma.$transaction(async (tx) => {
        // Upsert FavoriteTable
        await tx.favoriteTable.create({
          data: {
            userId: session.user.id,
            tableId: tableId,
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
    console.error("Error toggling table favorite:", error)
    return NextResponse.json(
      { error: "Failed to toggle table favorite." },
      { status: 500 }
    )
  }
}
