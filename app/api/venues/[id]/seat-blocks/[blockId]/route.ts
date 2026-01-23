import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditVenue } from "@/lib/venue-auth"

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; blockId: string }> }
) {
  try {
    const params = await context.params
    const venueId = params.id
    const blockId = params.blockId

    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check authorization
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, ownerId: true },
    })

    if (!venue) {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 })
    }

    if (!canEditVenue(session.user, venue)) {
      return NextResponse.json(
        { error: "You don't have permission to unblock seats for this venue." },
        { status: 403 }
      )
    }

    // Verify block exists and belongs to venue
    const block = await prisma.seatBlock.findUnique({
      where: { id: blockId },
      select: { venueId: true },
    })

    if (!block) {
      return NextResponse.json({ error: "Seat block not found" }, { status: 404 })
    }

    if (block.venueId !== venueId) {
      return NextResponse.json(
        { error: "Seat block does not belong to this venue." },
        { status: 403 }
      )
    }

    await prisma.seatBlock.delete({
      where: { id: blockId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting seat block:", error)
    return NextResponse.json(
      { error: "Failed to delete seat block." },
      { status: 500 }
    )
  }
}
