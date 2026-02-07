import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireVenueAdminOrOwner } from "@/lib/venue-members"

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const venueId = params.id

    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 })
    }

    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, ownerId: true },
    })

    if (!venue) {
      return NextResponse.json({ error: "Venue not found." }, { status: 404 })
    }

    const guard = await requireVenueAdminOrOwner(venueId, session.user, venue)
    if (guard) return guard

    const members = await prisma.venueMember.findMany({
      where: { venueId },
      select: { id: true, email: true, role: true, userId: true },
      orderBy: { email: "asc" },
    })

    return NextResponse.json({
      members: members.map((m) => ({
        id: m.id,
        email: m.email,
        role: m.role,
        userId: m.userId,
      })),
    })
  } catch (e) {
    console.error("GET /api/venues/[id]/members:", e)
    return NextResponse.json(
      { error: "Failed to fetch members." },
      { status: 500 }
    )
  }
}

function isValidEmail(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 255) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const venueId = params.id

    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 })
    }

    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, ownerId: true },
    })

    if (!venue) {
      return NextResponse.json({ error: "Venue not found." }, { status: 404 })
    }

    const guard = await requireVenueAdminOrOwner(venueId, session.user, venue)
    if (guard) return guard

    const body = await request.json().catch(() => ({}))
    const rawEmail = body?.email
    if (typeof rawEmail !== "string") {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      )
    }

    const email = rawEmail.trim().toLowerCase()
    if (!email) {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      )
    }
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      )
    }

    const existing = await prisma.venueMember.findUnique({
      where: { venueId_email: { venueId, email } },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json(
        { error: "This email is already a member." },
        { status: 409 }
      )
    }

    // Match user by email case-insensitively (OAuth may store email with original casing)
    const userByEmail = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    })

    await prisma.venueMember.create({
      data: {
        venueId,
        email,
        role: "staff",
        userId: userByEmail?.id ?? null,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("POST /api/venues/[id]/members:", e)
    return NextResponse.json(
      { error: "Failed to add member." },
      { status: 500 }
    )
  }
}
