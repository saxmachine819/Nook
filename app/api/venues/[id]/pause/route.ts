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
        { error: "You must be signed in to pause this venue." },
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
        { error: "You don't have permission to pause this venue." },
        { status: 403 }
      )
    }

    if (venue.status === "DELETED") {
      return NextResponse.json(
        { error: "Cannot pause a deleted venue." },
        { status: 409 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { pauseMessage, cancelFutureReservations } = body as {
      pauseMessage?: string
      cancelFutureReservations?: boolean
    }

    const now = new Date()

    const result = await prisma.$transaction(async (tx) => {
      let futureReservationsCancelled = 0
      if (cancelFutureReservations === true) {
        const updateResult = await tx.reservation.updateMany({
          where: {
            venueId,
            startAt: { gt: now },
            status: { not: "cancelled" },
          },
          data: {
            status: "cancelled",
            cancellationReason: "VENUE_PAUSED",
          },
        })
        futureReservationsCancelled = updateResult.count
      }

      await tx.venue.update({
        where: { id: venueId },
        data: {
          status: "PAUSED",
          pausedAt: now,
          pauseMessage: pauseMessage?.trim() || null,
        },
      })

      await writeAuditLog(
        {
          actorUserId: session.user.id,
          action: "VENUE_PAUSED",
          entityType: "VENUE",
          entityId: venueId,
          metadata: {
            cancelFutureReservations: !!cancelFutureReservations,
            futureReservationsCancelled: futureReservationsCancelled,
          },
        },
        tx as any
      )

      return { futureReservationsCancelled }
    })

    return NextResponse.json({
      success: true,
      venue: { id: venueId, status: "PAUSED", pausedAt: now.toISOString(), pauseMessage: pauseMessage?.trim() || null },
      ...result,
    })
  } catch (error) {
    console.error("Error pausing venue:", error)
    return NextResponse.json(
      { error: "Failed to pause venue. Please try again." },
      { status: 500 }
    )
  }
}
