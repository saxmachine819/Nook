import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const count = await prisma.venue.count({
      where: {
        ownerId: session.user.id,
        status: { not: "DELETED" },
      },
    })

    let singleVenueId: string | null = null
    if (count === 1) {
      const venue = await prisma.venue.findFirst({
        where: {
          ownerId: session.user.id,
          status: { not: "DELETED" },
        },
        select: { id: true },
      })
      singleVenueId = venue?.id ?? null
    }

    return NextResponse.json({ count, singleVenueId })
  } catch (e) {
    console.error("GET /api/users/me/venues/summary:", e)
    return NextResponse.json(
      { error: "Failed to fetch venue summary." },
      { status: 500 }
    )
  }
}
