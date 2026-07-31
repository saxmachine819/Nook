import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isReservationReviewable, isValidRating } from "@/lib/review-eligibility"

export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to leave a review." },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => null)
    const reservationId = body?.reservationId
    const rating = body?.rating
    const comment = typeof body?.comment === "string" ? body.comment.trim() || null : null

    if (typeof reservationId !== "string" || !reservationId) {
      return NextResponse.json({ error: "reservationId is required." }, { status: 400 })
    }

    if (!isValidRating(rating)) {
      return NextResponse.json({ error: "rating must be an integer from 1 to 5." }, { status: 400 })
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
    })

    if (!reservation || reservation.userId !== session.user.id) {
      return NextResponse.json({ error: "Reservation not found." }, { status: 404 })
    }

    if (!isReservationReviewable(reservation)) {
      return NextResponse.json(
        { error: "This reservation isn't eligible for a review yet." },
        { status: 400 }
      )
    }

    const existing = await prisma.review.findUnique({
      where: { reservationId },
    })

    if (existing) {
      return NextResponse.json(
        { error: "You've already reviewed this reservation." },
        { status: 409 }
      )
    }

    const review = await prisma.review.create({
      data: {
        venueId: reservation.venueId,
        userId: session.user.id,
        reservationId,
        rating,
        comment,
      },
    })

    return NextResponse.json({ review })
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "You've already reviewed this reservation." },
        { status: 409 }
      )
    }
    console.error("Error creating review:", error)
    return NextResponse.json({ error: "Failed to create review." }, { status: 500 })
  }
}
