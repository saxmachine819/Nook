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
      select: { id: true, venueId: true, isActive: true },
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
    const { isActive } = body as { isActive: boolean }

    if (typeof isActive !== "boolean") {
      return NextResponse.json(
        { error: "isActive must be a boolean" },
        { status: 400 }
      )
    }

    // Enforce only one active deal at a time
    if (isActive) {
      // When activating: deactivate all others and feature this one
      const deal = await prisma.$transaction(async (tx) => {
        // Deactivate all other deals for this venue
        await tx.deal.updateMany({
          where: {
            venueId,
            id: { not: dealId },
          },
          data: { isActive: false, featured: false },
        })

        // Activate and feature this deal
        return await tx.deal.update({
          where: { id: dealId },
          data: { isActive: true, featured: true },
        })
      })

      return NextResponse.json({ deal })
    } else {
      // When deactivating: just deactivate this deal
      const deal = await prisma.deal.update({
        where: { id: dealId },
        data: { isActive: false, featured: false },
      })

      return NextResponse.json({ deal })
    }
  } catch (error) {
    console.error("Error toggling active status:", error)
    return NextResponse.json(
      { error: "Failed to update active status" },
      { status: 500 }
    )
  }
}
