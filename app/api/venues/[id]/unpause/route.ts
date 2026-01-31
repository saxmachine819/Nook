import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditVenue } from "@/lib/venue-auth"
import { writeAuditLog } from "@/lib/audit"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to unpause this venue." },
        { status: 401 }
      )
    }

    const params = await context.params
    const venueId = params.id

    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, name: true, ownerId: true, status: true },
    })

    if (!venue) {
      return NextResponse.json({ error: "Venue not found." }, { status: 404 })
    }

    if (!canEditVenue(session.user, venue)) {
      return NextResponse.json(
        { error: "You don't have permission to unpause this venue." },
        { status: 403 }
      )
    }

    if (venue.status === "DELETED") {
      return NextResponse.json(
        { error: "Cannot unpause a deleted venue." },
        { status: 409 }
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.venue.update({
        where: { id: venueId },
        data: {
          status: "ACTIVE",
          pausedAt: null,
          pauseMessage: null,
        },
      })

      await writeAuditLog(
        {
          actorUserId: session.user.id,
          action: "VENUE_UNPAUSED",
          entityType: "VENUE",
          entityId: venueId,
          metadata: {},
        },
        tx as any
      )
    })

    return NextResponse.json({
      success: true,
      venue: { id: venueId, status: "ACTIVE", pausedAt: null, pauseMessage: null },
    })
  } catch (error) {
    console.error("Error unpausing venue:", error)
    return NextResponse.json(
      { error: "Failed to unpause venue. Please try again." },
      { status: 500 }
    )
  }
}
