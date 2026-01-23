import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditVenue } from "@/lib/venue-auth"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const venueId = params.id

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
        { error: "You don't have permission to block seats for this venue." },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { seatId, startAt, endAt, reason, duration } = body as {
      seatId?: string | null
      startAt?: string
      endAt?: string
      reason?: string
      duration?: "1hour" | "today" | "custom"
    }

    if (!startAt) {
      return NextResponse.json(
        { error: "startAt is required." },
        { status: 400 }
      )
    }

    const parsedStart = new Date(startAt)
    if (isNaN(parsedStart.getTime())) {
      return NextResponse.json(
        { error: "Invalid startAt date format." },
        { status: 400 }
      )
    }

    let parsedEnd: Date

    if (duration === "1hour") {
      parsedEnd = new Date(parsedStart.getTime() + 60 * 60 * 1000)
    } else if (duration === "today") {
      parsedEnd = new Date(parsedStart)
      parsedEnd.setHours(23, 59, 59, 999)
    } else if (duration === "custom" && endAt) {
      parsedEnd = new Date(endAt)
      if (isNaN(parsedEnd.getTime())) {
        return NextResponse.json(
          { error: "Invalid endAt date format." },
          { status: 400 }
        )
      }
    } else {
      return NextResponse.json(
        { error: "Either duration or endAt must be provided." },
        { status: 400 }
      )
    }

    if (parsedEnd <= parsedStart) {
      return NextResponse.json(
        { error: "End time must be after start time." },
        { status: 400 }
      )
    }

    // Verify seat exists if seatId provided
    if (seatId) {
      const seat = await prisma.seat.findUnique({
        where: { id: seatId },
        select: { id: true, table: { select: { venueId: true } } },
      })

      if (!seat || seat.table.venueId !== venueId) {
        return NextResponse.json(
          { error: "Seat not found or does not belong to this venue." },
          { status: 404 }
        )
      }
    }

    const block = await prisma.seatBlock.create({
      data: {
        venueId,
        seatId: seatId || null,
        startAt: parsedStart,
        endAt: parsedEnd,
        reason: reason?.trim() || null,
        createdByUserId: session.user.id,
      },
    })

    return NextResponse.json({ block }, { status: 201 })
  } catch (error) {
    console.error("Error creating seat block:", error)
    return NextResponse.json(
      { error: "Failed to create seat block." },
      { status: 500 }
    )
  }
}
