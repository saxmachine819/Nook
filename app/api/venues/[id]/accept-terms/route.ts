import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to accept venue terms." },
        { status: 401 }
      )
    }

    const venueId = params.id

    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, ownerId: true, onboardingStatus: true },
    })

    if (!venue) {
      return NextResponse.json({ error: "Venue not found." }, { status: 404 })
    }

    if (venue.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: "You do not have permission to accept terms for this venue." },
        { status: 403 }
      )
    }

    if (venue.onboardingStatus !== "DRAFT") {
      return NextResponse.json(
        { error: "Venue terms can only be accepted for venues in draft onboarding." },
        { status: 400 }
      )
    }

    await prisma.venue.update({
      where: { id: venueId },
      data: { venueTermsAcceptedAt: new Date() },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("POST /api/venues/[id]/accept-terms:", e)
    return NextResponse.json(
      { error: "Failed to accept venue terms." },
      { status: 500 }
    )
  }
}
