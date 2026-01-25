import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditVenue } from "@/lib/venue-auth"
import { DealType } from "@prisma/client"

interface RouteContext {
  params: Promise<{ id: string; dealId: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: venueId, dealId } = await context.params
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch venue to check authorization
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, ownerId: true },
    })

    if (!venue) {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 })
    }

    // Check authorization
    if (!canEditVenue(session.user, venue)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify deal belongs to venue
    const existingDeal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, venueId: true },
    })

    if (!existingDeal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 })
    }

    if (existingDeal.venueId !== venueId) {
      return NextResponse.json(
        { error: "Deal does not belong to this venue" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { type, title, description, eligibilityJson, isActive } = body as {
      type?: DealType
      title?: string
      description?: string
      eligibilityJson?: any
      isActive?: boolean
    }

    // Validate deal type if provided
    if (type && !Object.values(DealType).includes(type)) {
      return NextResponse.json(
        { error: "Invalid deal type" },
        { status: 400 }
      )
    }

    // Update deal
    const deal = await prisma.deal.update({
      where: { id: dealId },
      data: {
        ...(type && { type }),
        ...(title && { title: title.trim() }),
        ...(description && { description: description.trim() }),
        ...(eligibilityJson !== undefined && { eligibilityJson }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json({ deal })
  } catch (error) {
    console.error("Error updating deal:", error)
    return NextResponse.json(
      { error: "Failed to update deal" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: venueId, dealId } = await context.params
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch venue to check authorization
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, ownerId: true },
    })

    if (!venue) {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 })
    }

    // Check authorization
    if (!canEditVenue(session.user, venue)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify deal belongs to venue
    const existingDeal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, venueId: true },
    })

    if (!existingDeal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 })
    }

    if (existingDeal.venueId !== venueId) {
      return NextResponse.json(
        { error: "Deal does not belong to this venue" },
        { status: 400 }
      )
    }

    // Delete deal
    await prisma.deal.delete({
      where: { id: dealId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting deal:", error)
    return NextResponse.json(
      { error: "Failed to delete deal" },
      { status: 500 }
    )
  }
}
