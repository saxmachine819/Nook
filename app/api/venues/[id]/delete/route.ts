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
        { error: "You must be signed in to delete this venue." },
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
        { error: "You don't have permission to delete this venue." },
        { status: 403 }
      )
    }

    if (venue.status === "DELETED") {
      return NextResponse.json(
        { error: "This venue is already deleted." },
        { status: 409 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { confirmation } = body as { confirmation?: string }

    const expectedConfirmation = venue.name?.trim() || "DELETE"
    if (confirmation !== expectedConfirmation && confirmation !== "DELETE") {
      return NextResponse.json(
        {
          error: `Type the venue name "${venue.name}" or DELETE to confirm.`,
          expected: expectedConfirmation,
        },
        { status: 400 }
      )
    }

    const now = new Date()

    const result = await prisma.$transaction(async (tx) => {
      const futureReservations = await tx.reservation.updateMany({
        where: {
          venueId,
          startAt: { gt: now },
          status: { not: "cancelled" },
        },
        data: {
          status: "cancelled",
          cancellationReason: "VENUE_DELETED",
        },
      })

      await tx.table.updateMany({
        where: { venueId },
        data: { isActive: false },
      })

      await tx.seat.updateMany({
        where: {
          table: { venueId },
        },
        data: { isActive: false },
      })

      await tx.venue.update({
        where: { id: venueId },
        data: {
          status: "DELETED",
          deletedAt: now,
        },
      })

      await writeAuditLog(
        {
          actorUserId: session.user.id,
          action: "VENUE_DELETED",
          entityType: "VENUE",
          entityId: venueId,
          metadata: {
            futureReservationsCancelled: futureReservations.count,
          },
        },
        tx as any
      )

      return { futureReservationsCancelled: futureReservations.count }
    })

    return NextResponse.json({
      success: true,
      message: "Venue has been deleted. It will no longer appear in listings.",
      ...result,
    })
  } catch (error) {
    console.error("Error deleting venue:", error)
    return NextResponse.json(
      { error: "Failed to delete venue. Please try again." },
      { status: 500 }
    )
  }
}
