import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  const reservationId = params.id

  try {
    // Check authentication
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to cancel a reservation." },
        { status: 401 }
      )
    }

    // Verify reservation exists and belongs to the user
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: {
        userId: true,
        status: true,
      },
    })

    if (!reservation) {
      return NextResponse.json(
        { error: "Reservation not found." },
        { status: 404 }
      )
    }

    // Only the owner can cancel their reservation
    if (reservation.userId !== session.user.id) {
      return NextResponse.json(
        { error: "You can only cancel your own reservations." },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { status } = body as { status?: string }

    // For MVP we only support cancelling a reservation.
    if (status && status !== "cancelled") {
      return NextResponse.json(
        { error: "Only cancelling reservations is supported." },
        { status: 400 }
      )
    }

    const updated = await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        status: "cancelled",
      },
      include: {
        venue: true,
      },
    })

    return NextResponse.json({ reservation: updated })
  } catch (error) {
    console.error("Error cancelling reservation:", error)
    return NextResponse.json(
      { error: "Failed to cancel reservation. Please try again." },
      { status: 500 }
    )
  }
}

