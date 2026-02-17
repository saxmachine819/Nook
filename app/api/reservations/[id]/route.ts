import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditVenue, isAdmin } from "@/lib/venue-auth"
import { enqueueNotification } from "@/lib/notification-queue"

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  const reservationId = params.id

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
            address: true,
            heroImageUrl: true,
            imageUrls: true,
            hourlySeatPrice: true,
            googleMapsUrl: true,
            rulesText: true,
            tags: true,
          },
        },
        seat: {
          include: {
            table: {
              select: {
                name: true,
                directionsText: true,
              },
            },
          },
        },
        table: {
          select: {
            name: true,
            seatCount: true,
            tablePricePerHour: true,
            directionsText: true,
            seats: {
              select: { id: true },
            },
          },
        },
        payments: {
          include: {
            refundRequests: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1
        },
      },
    })

    if (!reservation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Map plural payments to singular payment for the client
    const mappedReservation = {
      ...reservation,
      payment: reservation.payments?.[0] || null
    }

    // Authorization: owner or admin
    const isOwner = mappedReservation.userId === session.user.id
    const userIsAdmin = isAdmin(session.user)

    if (!isOwner && !userIsAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json(mappedReservation)
  } catch (error) {
    console.error("Error fetching reservation:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  const reservationId = params.id

  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to modify a reservation." },
        { status: 401 }
      )
    }

    // Fetch reservation with venue for authorization check
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        venue: {
          select: {
            id: true,
            ownerId: true,
          },
        },
      },
    })

    if (!reservation) {
      return NextResponse.json(
        { error: "Reservation not found." },
        { status: 404 }
      )
    }

    // Authorization: venue owner/admin OR reservation owner can edit
    const isVenueOwnerOrAdmin = canEditVenue(session.user, reservation.venue)
    const isReservationOwner = reservation.userId === session.user.id

    if (!isVenueOwnerOrAdmin && !isReservationOwner) {
      return NextResponse.json(
        { error: "You don't have permission to modify this reservation." },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { status, startAt, endAt, seatId } = body as {
      status?: string
      startAt?: string
      endAt?: string
      seatId?: string | null
    }

    // Handle cancellation
    if (status === "cancelled") {
      const updated = await prisma.reservation.update({
        where: { id: reservationId },
        data: { status: "cancelled" },
        include: {
          venue: { include: { owner: { select: { email: true } } } },
          user: { select: { email: true } },
          seat: { include: { table: { select: { name: true } } } },
          table: { select: { name: true } },
        },
      })
      if (updated.user?.email?.trim()) {
        try {
          await enqueueNotification({
            type: "booking_canceled",
            dedupeKey: `booking_canceled:${updated.id}`,
            toEmail: updated.user.email.trim(),
            userId: updated.userId,
            venueId: updated.venueId,
            bookingId: updated.id,
            payload: {
              venueName: updated.venue?.name ?? "",
              timeZone: updated.venue?.timezone ?? undefined,
              startAt: updated.startAt.toISOString(),
              canceledAt: new Date().toISOString(),
            },
          })
        } catch (enqueueErr) {
          console.error("Failed to enqueue booking_canceled:", enqueueErr)
        }
      }
      if (updated.venue?.owner?.email?.trim()) {
        try {
          await enqueueNotification({
            type: "venue_booking_canceled",
            dedupeKey: `venue_booking_canceled:${updated.id}`,
            toEmail: updated.venue.owner.email.trim(),
            userId: updated.venue.ownerId ?? undefined,
            venueId: updated.venueId,
            bookingId: updated.id,
            payload: {
              venueName: updated.venue?.name ?? "",
              timeZone: updated.venue?.timezone ?? undefined,
              guestEmail: updated.user?.email ?? "",
              startAt: updated.startAt.toISOString(),
              canceledAt: new Date().toISOString(),
            },
          })
        } catch (enqueueErr) {
          console.error("Failed to enqueue venue_booking_canceled:", enqueueErr)
        }
      }
      return NextResponse.json({ reservation: updated })
    }

    // Handle editing (only venue owner/admin can edit, not reservation owner)
    if ((startAt || endAt || seatId !== undefined) && !isVenueOwnerOrAdmin) {
      return NextResponse.json(
        { error: "Only venue owners and admins can edit reservations." },
        { status: 403 }
      )
    }

    if (startAt || endAt || seatId !== undefined) {
      const newStartAt = startAt ? new Date(startAt) : reservation.startAt
      const newEndAt = endAt ? new Date(endAt) : reservation.endAt
      const newSeatId = seatId !== undefined ? seatId : reservation.seatId

      // Validate dates
      if (isNaN(newStartAt.getTime()) || isNaN(newEndAt.getTime())) {
        return NextResponse.json(
          { error: "Invalid date format." },
          { status: 400 }
        )
      }

      if (newEndAt <= newStartAt) {
        return NextResponse.json(
          { error: "End time must be after start time." },
          { status: 400 }
        )
      }

      // Check availability (exclude current reservation, include SeatBlocks)
      const overlappingReservations = await prisma.reservation.findMany({
        where: {
          venueId: reservation.venueId,
          id: { not: reservationId },
          status: { not: "cancelled" },
          startAt: { lt: newEndAt },
          endAt: { gt: newStartAt },
        },
        select: {
          seatId: true,
          tableId: true,
        },
      })

      // Check SeatBlocks
      const overlappingBlocks = await prisma.seatBlock.findMany({
        where: {
          venueId: reservation.venueId,
          startAt: { lt: newEndAt },
          endAt: { gt: newStartAt },
        },
        select: {
          seatId: true,
        },
      })

      // If editing seat, check if new seat is available
      if (newSeatId && newSeatId !== reservation.seatId) {
        // Check if seat is blocked
        const isBlocked = overlappingBlocks.some((block) => block.seatId === newSeatId)
        if (isBlocked) {
          return NextResponse.json(
            { error: "This seat is blocked during the requested time." },
            { status: 409 }
          )
        }

        // Check if seat is reserved
        const isReserved = overlappingReservations.some((r) => r.seatId === newSeatId)
        if (isReserved) {
          return NextResponse.json(
            { error: "This seat is already reserved for the requested time." },
            { status: 409 }
          )
        }
      } else if (reservation.seatId) {
        // If keeping same seat, check if it's available (excluding current reservation)
        const isBlocked = overlappingBlocks.some((block) => block.seatId === reservation.seatId)
        if (isBlocked) {
          return NextResponse.json(
            { error: "This seat is blocked during the requested time." },
            { status: 409 }
          )
        }

        const isReserved = overlappingReservations.some((r) => r.seatId === reservation.seatId)
        if (isReserved) {
          return NextResponse.json(
            { error: "This seat is already reserved for the requested time." },
            { status: 409 }
          )
        }
      }

      // Update reservation
      const updated = await prisma.reservation.update({
        where: { id: reservationId },
        data: {
          startAt: newStartAt,
          endAt: newEndAt,
          seatId: newSeatId !== undefined ? newSeatId : reservation.seatId,
        },
        include: {
          venue: true,
          user: { select: { email: true } },
          seat: { include: { table: { select: { name: true } } } },
          table: { select: { name: true } },
        },
      })

      return NextResponse.json({ reservation: updated })
    }

    // No changes provided
    return NextResponse.json(
      { error: "No valid changes provided." },
      { status: 400 }
    )
  } catch (error) {
    console.error("Error updating reservation:", error)
    return NextResponse.json(
      { error: "Failed to update reservation. Please try again." },
      { status: 500 }
    )
  }
}

