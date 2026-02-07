import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireVenueAdminOrOwner } from "@/lib/venue-members"

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const params = await context.params
    const venueId = params.id
    const memberId = params.memberId

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

    const member = await prisma.venueMember.findFirst({
      where: { id: memberId, venueId },
      select: { id: true },
    })

    if (!member) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 })
    }

    await prisma.venueMember.delete({
      where: { id: memberId },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("DELETE /api/venues/[id]/members/[memberId]:", e)
    return NextResponse.json(
      { error: "Failed to remove member." },
      { status: 500 }
    )
  }
}
