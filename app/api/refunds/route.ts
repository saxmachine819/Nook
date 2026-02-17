import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const reservationId = body?.reservationId as string | undefined
    const reason = body?.reason as string | undefined

    if (!reservationId) {
      return NextResponse.json({ error: "Reservation ID is required." }, { status: 400 })
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { id: true, userId: true, venueId: true },
    })

    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found." }, { status: 404 })
    }

    if (reservation.userId !== session.user.id) {
      return NextResponse.json({ error: "You can only request refunds for your own reservations." }, { status: 403 })
    }

    const payment = await prisma.payment.findFirst({
      where: { reservationId },
    })

    if (!payment) {
      return NextResponse.json({ error: "Payment not found for this reservation." }, { status: 404 })
    }

    const existing = await prisma.refundRequest.findFirst({
      where: {
        reservationId,
        status: { in: ["REQUESTED", "APPROVED", "PROCESSING"] },
      },
    })

    if (existing) {
      return NextResponse.json({ error: "A refund request is already pending." }, { status: 400 })
    }

    const refundableAmount = Math.max(0, payment.amount - payment.amountRefunded)
    if (refundableAmount <= 0) {
      return NextResponse.json({ error: "This payment has already been fully refunded." }, { status: 400 })
    }

    const refundRequest = await prisma.refundRequest.create({
      data: {
        paymentId: payment.id,
        reservationId,
        venueId: payment.venueId,
        userId: session.user.id,
        requestedAmount: refundableAmount,
        reason: reason?.trim() || null,
      },
    })

    return NextResponse.json({ refundRequest })
  } catch (error) {
    console.error("POST /api/refunds:", error)
    return NextResponse.json({ error: "Failed to create refund request." }, { status: 500 })
  }
}
