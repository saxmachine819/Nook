import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditVenue } from "@/lib/venue-auth"

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 })
    }

    const params = await context.params
    const venueId = params.id

    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, ownerId: true },
    })

    if (!venue) {
      return NextResponse.json({ error: "Venue not found." }, { status: 404 })
    }

    if (!canEditVenue(session.user, venue)) {
      return NextResponse.json({ error: "Permission denied." }, { status: 403 })
    }

    const refundRequests = await prisma.refundRequest.findMany({
      where: { venueId },
      include: {
        reservation: true,
        user: { select: { email: true, name: true } },
        payment: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ refundRequests })
  } catch (error) {
    console.error("GET /api/venues/[id]/refunds:", error)
    return NextResponse.json({ error: "Failed to load refund requests." }, { status: 500 })
  }
}
