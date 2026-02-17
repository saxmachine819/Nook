import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { ReservationListItem } from "@/lib/types/reservations"
import { getCanonicalVenueHours, isReservationWithinCanonicalHours } from "@/lib/hours"
import { canBookVenue, BookingNotAllowedError } from "@/lib/booking-guard"
import { buildBookingContext, computeBookingPrice, createReservationFromContext } from "@/lib/booking"
import { enqueueNotification } from "@/lib/notification-queue"

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tab = searchParams.get("tab") as "upcoming" | "past" | "cancelled" | null
    const now = new Date()

    const where: Prisma.ReservationWhereInput = { userId: session.user.id }

    if (tab === "upcoming") {
      where.status = { not: "cancelled" }
      where.endAt = { gte: now }
    } else if (tab === "past") {
      where.status = { not: "cancelled" }
      where.endAt = { lt: now }
    } else if (tab === "cancelled") {
      where.status = "cancelled"
    }

    const reservations = await prisma.reservation.findMany({
      where,
      include: {
        venue: {
          select: {
            id: true,
            name: true,
            address: true,
            heroImageUrl: true,
            imageUrls: true,
            hourlySeatPrice: true,
          },
        },
        seat: {
          select: {
            id: true,
            label: true,
            position: true,
            pricePerHour: true,
            table: { select: { name: true } },
          },
        },
        table: {
          select: {
            name: true,
            seatCount: true,
            tablePricePerHour: true,
            seats: { select: { id: true } },
          },
        },
      },
      orderBy: {
        startAt: tab === "upcoming" ? "asc" : "desc",
      },
    })

    return NextResponse.json(reservations)
  } catch (error) {
    console.error("Error in GET /api/reservations:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      console.error("❌ No session found")
      return NextResponse.json(
        { error: "You must be signed in to make a reservation." },
        { status: 401 }
      )
    }

    if (!session.user.id) {
      console.error("❌ Session user missing id:", { user: session.user })
      return NextResponse.json(
        { error: "Authentication error: user ID not found." },
        { status: 401 }
      )
    }

    const body = await request.json()

    // Verify user exists in database and has accepted terms
    const userRecord = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, termsAcceptedAt: true },
    })

    if (!userRecord) {
      console.error("❌ User not found in database:", {
        userId: session.user.id,
        email: session.user.email,
      })
      return NextResponse.json(
        { error: "User account not found. Please sign out and sign in again." },
        { status: 401 }
      )
    }

    if (!userRecord.termsAcceptedAt) {
      return NextResponse.json(
        { error: "You must accept the Terms & Conditions to make a reservation." },
        { status: 403 }
      )
    }

    // Additional guards from main (canonical hours and booking-guard)
    const { venueId, startAt, endAt } = body
    if (venueId && startAt && endAt) {
      try {
        const canonicalHours = await getCanonicalVenueHours(venueId)
        if (canonicalHours) {
          const isWithin = isReservationWithinCanonicalHours(
            new Date(startAt),
            new Date(endAt),
            canonicalHours
          )
          if (!isWithin) {
            return NextResponse.json(
              { error: "Reservation is outside of venue's operating hours." },
              { status: 400 }
            )
          }
        }
        
        await canBookVenue(venueId, session.user.id)
      } catch (err) {
        if (err instanceof BookingNotAllowedError) {
          return NextResponse.json({ error: err.message }, { status: 403 })
        }
        // Other errors might be venue not found, etc., which buildBookingContext will handle
      }
    }

    let context: Awaited<ReturnType<typeof buildBookingContext>>
    try {
      context = await buildBookingContext(body, session.user.id)
    } catch (err: any) {
      const status = err?.status ?? 400
      const code = err?.code
      return NextResponse.json(
        { error: err?.message || "Failed to create reservation.", ...(code ? { code } : {}) },
        { status }
      )
    }

    const reservation = await createReservationFromContext(context, session.user.id)
    const { totalPricePerHour, seatCountForAverage } = computeBookingPrice(context)

    // Enqueue booking confirmation email (no inline send).
    if (userRecord.email?.trim()) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? ""
        await enqueueNotification({
          type: "booking_confirmation",
          dedupeKey: `booking_confirmation:${reservation.id}`,
          toEmail: userRecord.email.trim(),
          userId: session.user.id,
          venueId: reservation.venueId,
          bookingId: reservation.id,
          payload: {
            bookingId: reservation.id,
            venueId: reservation.venueId,
            venueName: reservation.venue?.name ?? "",
            timeZone: reservation.venue?.timezone ?? undefined,
            tableId: reservation.tableId ?? null,
            seatId: reservation.seatId ?? null,
            startAt: new Date(reservation.startAt).toISOString(),
            endAt: new Date(reservation.endAt).toISOString(),
            ...(baseUrl ? { confirmationUrl: `${baseUrl}/reservations/${reservation.id}` } : {}),
          },
        })
      } catch (enqueueErr) {
        console.error("Failed to enqueue booking confirmation:", enqueueErr)
      }
    }

    // Enqueue venue owner notification (new booking at their venue).
    if (reservation.venue?.owner?.email?.trim()) {
      try {
        await enqueueNotification({
          type: "venue_booking_created",
          dedupeKey: `venue_booking_created:${reservation.id}`,
          toEmail: reservation.venue.owner.email.trim(),
          userId: reservation.venue.ownerId ?? undefined,
          venueId: reservation.venueId,
          bookingId: reservation.id,
          payload: {
            venueName: reservation.venue?.name ?? "",
            timeZone: reservation.venue?.timezone ?? undefined,
            guestEmail: userRecord.email ?? "",
            startAt: new Date(reservation.startAt).toISOString(),
            endAt: new Date(reservation.endAt).toISOString(),
          },
        })
      } catch (enqueueErr) {
        console.error("Failed to enqueue venue_booking_created:", enqueueErr)
      }
    }

    const reservationWithPricing = {
      ...reservation,
      venue: {
        ...reservation.venue,
        averageSeatPrice: totalPricePerHour / seatCountForAverage, // Average for display
      },
    }

    return NextResponse.json(
      {
        reservation: reservationWithPricing,
      },
      { status: 201 }
    )
  } catch (err: unknown) {
    const error = err as any // Local cast for logging properties safely
    console.error("❌ Error creating reservation:", error)
    console.error("Error details:", {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
      name: error?.name,
    })

    // Check for foreign key constraint errors
    if (error?.code === "P2003") {
      console.error("Foreign key constraint violation:", error?.meta)
      return NextResponse.json(
        {
          error: "User account not found. Please sign out and sign in again.",
          details:
            process.env.NODE_ENV === "development"
              ? {
                  message: error?.message,
                  code: error?.code,
                  meta: error?.meta,
                }
              : undefined,
        },
        { status: 401 }
      )
    }

    return NextResponse.json(
      {
        error: "Failed to create reservation. Please try again.",
        details:
          process.env.NODE_ENV === "development"
            ? {
                message: error?.message,
                code: error?.code,
                meta: error?.meta,
              }
            : undefined,
      },
      { status: 500 }
    )
  }
}
