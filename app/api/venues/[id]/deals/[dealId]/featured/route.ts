import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditVenue } from "@/lib/venue-auth"

interface RouteContext {
  params: Promise<{ id: string; dealId: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: venueId, dealId } = await context.params
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

    // Check authorization
    if (!canEditVenue(session.user, venue)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify deal belongs to venue
    const existingDeal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, venueId: true, featured: true },
    })

    if (!existingDeal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 })
    }

    if (existingDeal.venueId !== venueId) {
      return NextResponse.json(
        { error: "Deal does not belong to this venue" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { featured } = body as { featured: boolean }

    if (typeof featured !== "boolean") {
      return NextResponse.json(
        { error: "featured must be a boolean" },
        { status: 400 }
      )
    }

    // Featured enforcement: use transaction to ensure only one featured deal
    if (featured) {
      const deal = await prisma.$transaction(async (tx) => {
        // Unfeature all other deals for this venue
        await tx.deal.updateMany({
          where: {
            venueId,
            id: { not: dealId },
          },
          data: { featured: false },
        })

        // Feature this deal
        return await tx.deal.update({
          where: { id: dealId },
          data: { featured: true },
        })
      })

      return NextResponse.json({ deal })
    } else {
      // Just unfeature this deal
      const deal = await prisma.deal.update({
        where: { id: dealId },
        data: { featured: false },
      })

      return NextResponse.json({ deal })
    }
  } catch (error) {
    console.error("Error toggling featured status:", error)
    return NextResponse.json(
      { error: "Failed to update featured status" },
      { status: 500 }
    )
  }
}
