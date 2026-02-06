import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeAuditLog } from "@/lib/audit"

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to delete your account." },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { confirmation, reason } = body as { confirmation?: string; reason?: string }

    if (confirmation !== "DELETE") {
      return NextResponse.json(
        { error: "Confirmation required. Type DELETE to confirm." },
        { status: 400 }
      )
    }

    const userId = session.user.id
    const now = new Date()

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      )
    }

    if (user.status === "DELETED") {
      return NextResponse.json(
        { error: "Account is already deleted." },
        { status: 409 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Cancel future reservations for this user
      const futureReservations = await tx.reservation.updateMany({
        where: {
          userId,
          startAt: { gt: now },
          status: { not: "cancelled" },
        },
        data: {
          status: "cancelled",
          cancellationReason: "USER_DELETED",
        },
      })
      const futureReservationsCancelled = futureReservations.count

      // 2. Pause all venues owned by this user
      const venuesPaused = await tx.venue.updateMany({
        where: { ownerId: userId },
        data: {
          status: "PAUSED",
          pausedAt: now,
        },
      })

      // 3. Anonymize user and mark deleted
      const placeholderEmail = `deleted+${userId}@example.invalid`
      await tx.user.update({
        where: { id: userId },
        data: {
          status: "DELETED",
          deletedAt: now,
          deletionReason: reason ?? null,
          name: "Deleted User",
          email: placeholderEmail,
          image: null,
        },
      })

      // 4. Audit log
      await writeAuditLog(
        {
          actorUserId: userId,
          action: "ACCOUNT_DELETED",
          entityType: "USER",
          entityId: userId,
          metadata: {
            futureReservationsCancelled,
            venuesPaused: venuesPaused.count,
          },
        },
        tx as any
      )

      return { futureReservationsCancelled, venuesPaused: venuesPaused.count }
    })

    return NextResponse.json({
      success: true,
      message: "Your account has been deleted.",
      ...result,
    })
  } catch (error) {
    console.error("Error deleting account:", error)
    return NextResponse.json(
      { error: "Failed to delete account. Please try again." },
      { status: 500 }
    )
  }
}
