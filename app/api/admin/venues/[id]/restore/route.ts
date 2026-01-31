import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/venue-auth"
import { writeAuditLog } from "@/lib/audit"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to restore a venue." },
        { status: 401 }
      )
    }

    if (!isAdmin(session.user)) {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required." },
        { status: 403 }
      )
    }

    const params = await context.params
    const venueId = params.id

    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, name: true, status: true },
    })

    if (!venue) {
      return NextResponse.json({ error: "Venue not found." }, { status: 404 })
    }

    if (venue.status !== "DELETED") {
      return NextResponse.json(
        { error: "Venue is not deleted. Nothing to restore." },
        { status: 409 }
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.table.updateMany({
        where: { venueId },
        data: { isActive: true },
      })

      await tx.seat.updateMany({
        where: { table: { venueId } },
        data: { isActive: true },
      })

      await tx.venue.update({
        where: { id: venueId },
        data: {
          status: "PAUSED",
          deletedAt: null,
        },
      })

      await writeAuditLog(
        {
          actorUserId: session.user.id,
          action: "VENUE_RESTORED",
          entityType: "VENUE",
          entityId: venueId,
          metadata: { restoredFrom: "DELETED", newStatus: "PAUSED" },
        },
        tx as any
      )
    })

    return NextResponse.json({
      success: true,
      venue: { id: venueId, status: "PAUSED" },
      message: "Venue restored. It is now PAUSED; owner can unpause to accept reservations.",
    })
  } catch (error) {
    console.error("Error restoring venue:", error)
    return NextResponse.json(
      { error: "Failed to restore venue. Please try again." },
      { status: 500 }
    )
  }
}
