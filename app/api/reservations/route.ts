import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

    // When using JWT, user.id should be set in the session callback
    if (!session.user.id) {
      console.error("❌ Session user missing id:", { user: session.user })
      return NextResponse.json(
        { error: "Authentication error: user ID not found." },
        { status: 401 }
      )
    }

    console.log("✅ Session found:", { 
      userId: session.user.id, 
      email: session.user.email,
      userIdType: typeof session.user.id,
      userIdLength: session.user.id?.length
    })

    const body = await request.json()
    const { venueId, startAt, endAt, seatCount } = body as {
      venueId?: string
      startAt?: string
      endAt?: string
      seatCount?: number
    }

    if (!venueId || !startAt || !endAt || !seatCount) {
      return NextResponse.json(
        { error: "Missing required fields for reservation." },
        { status: 400 }
      )
    }

    const parsedStart = new Date(startAt)
    const parsedEnd = new Date(endAt)

    if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
      return NextResponse.json({ error: "Invalid dates provided." }, { status: 400 })
    }

    if (parsedEnd <= parsedStart) {
      return NextResponse.json(
        { error: "End time must be after start time." },
        { status: 400 }
      )
    }

    if (seatCount < 1) {
      return NextResponse.json(
        { error: "You must reserve at least one seat." },
        { status: 400 }
      )
    }

    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      include: { tables: true },
    })

    if (!venue) {
      return NextResponse.json({ error: "Venue not found." }, { status: 404 })
    }

    const capacity = venue.tables.reduce((sum, table) => sum + table.seatCount, 0)

    if (capacity <= 0) {
      return NextResponse.json(
        { error: "This venue has no reservable seats configured yet." },
        { status: 400 }
      )
    }

    if (seatCount > capacity) {
      return NextResponse.json(
        { error: `This venue can host up to ${capacity} seats at once.` },
        { status: 400 }
      )
    }

    // Find overlapping reservations for this venue and time window.
    // Overlap logic: existing.startAt < requestedEnd AND existing.endAt > requestedStart
    const overlappingReservations = await prisma.reservation.findMany({
      where: {
        venueId: venue.id,
        status: {
          not: "cancelled",
        },
        startAt: {
          lt: parsedEnd,
        },
        endAt: {
          gt: parsedStart,
        },
      },
      select: {
        seatCount: true,
      },
    })

    const bookedSeats = overlappingReservations.reduce(
      (sum, res) => sum + res.seatCount,
      0
    )

    if (bookedSeats + seatCount > capacity) {
      return NextResponse.json(
        { error: "Not enough seats available for that time." },
        { status: 409 }
      )
    }

    // Verify user exists in database (required for foreign key constraint)
    console.log("🔍 Checking if user exists:", { userId: session.user.id })
    
    const userExists = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true },
    })

    console.log("🔍 User lookup result:", { 
      found: !!userExists, 
      userId: session.user.id,
      userEmail: userExists?.email 
    })

    if (!userExists) {
      console.error("❌ User not found in database:", { 
        userId: session.user.id,
        email: session.user.email 
      })
      
      // Try to find user by email as fallback
      const userByEmail = await prisma.user.findUnique({
        where: { email: session.user.email || undefined },
        select: { id: true },
      })
      
      if (userByEmail) {
        console.error("⚠️ User found by email but ID mismatch:", {
          sessionUserId: session.user.id,
          dbUserId: userByEmail.id,
          email: session.user.email
        })
      }
      
      return NextResponse.json(
        { error: "User account not found. Please sign out and sign in again." },
        { status: 401 }
      )
    }

    // NOTE: For MVP we use simple check-then-create. This is not fully concurrency safe.
    // TODO: Add transactional locking / seat hold logic to prevent race conditions.
    const reservation = await prisma.reservation.create({
      data: {
        venueId: venue.id,
        userId: session.user.id,
        startAt: parsedStart,
        endAt: parsedEnd,
        seatCount,
        status: "active",
      },
      include: {
        venue: true,
      },
    })

    return NextResponse.json(
      {
        reservation,
      },
      { status: 201 }
    )
  } catch (error: any) {
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
          details: process.env.NODE_ENV === "development" ? {
            message: error?.message,
            code: error?.code,
            meta: error?.meta,
          } : undefined
        },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { 
        error: "Failed to create reservation. Please try again.",
        details: process.env.NODE_ENV === "development" ? {
          message: error?.message,
          code: error?.code,
          meta: error?.meta,
        } : undefined
      },
      { status: 500 }
    )
  }
}

