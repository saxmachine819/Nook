import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to view favorites." },
        { status: 401 }
      )
    }

    // Fetch all favorites for the user with related data
    const [favoriteVenues, favoriteTables, favoriteSeats] = await Promise.all([
      prisma.favoriteVenue.findMany({
        where: { userId: session.user.id },
        include: {
          venue: {
            include: {
              venueHours: {
                orderBy: {
                  dayOfWeek: "asc",
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.favoriteTable.findMany({
        where: { userId: session.user.id },
        include: {
          table: {
            include: {
              venue: {
                include: {
                  venueHours: {
                    orderBy: {
                      dayOfWeek: "asc",
                    },
                  },
                },
              },
              seats: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.favoriteSeat.findMany({
        where: { userId: session.user.id },
        include: {
          seat: {
            include: {
              table: {
                include: {
                  venue: {
                    include: {
                      venueHours: {
                        orderBy: {
                          dayOfWeek: "asc",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
    ])

    return NextResponse.json({
      venues: favoriteVenues.map((fv: any) => ({
        id: fv.id,
        createdAt: fv.createdAt,
        venue: fv.venue,
      })),
      tables: favoriteTables.map((ft: any) => ({
        id: ft.id,
        createdAt: ft.createdAt,
        table: ft.table,
      })),
      seats: favoriteSeats.map((fs: any) => ({
        id: fs.id,
        createdAt: fs.createdAt,
        seat: fs.seat,
      })),
    })
  } catch (error) {
    console.error("Error fetching favorites:", error)
    return NextResponse.json(
      { error: "Failed to fetch favorites." },
      { status: 500 }
    )
  }
}
