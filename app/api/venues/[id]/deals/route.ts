import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditVenue } from "@/lib/venue-auth"
import { DealType } from "@prisma/client"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: venueId } = await context.params
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

    // Fetch deals
    const deals = await prisma.deal.findMany({
      where: { venueId },
      orderBy: [
        { featured: "desc" },
        { createdAt: "desc" },
      ],
    })

    return NextResponse.json({ deals })
  } catch (error) {
    console.error("Error fetching deals:", error)
    return NextResponse.json(
      { error: "Failed to fetch deals" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: venueId } = await context.params
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

    const body = await request.json()
    const { type, title, description, eligibilityJson } = body as {
      type: DealType
      title: string
      description: string
      eligibilityJson?: any
    }

    // Validate required fields
    if (!type || !title || !description) {
      return NextResponse.json(
        { error: "Missing required fields: type, title, description" },
        { status: 400 }
      )
    }

    // Validate deal type
    if (!Object.values(DealType).includes(type)) {
      return NextResponse.json(
        { error: "Invalid deal type" },
        { status: 400 }
      )
    }

    // Create deal - new deals are always active and featured
    // (Only one deal can be active at a time, and active deals are automatically featured)
    const deal = await prisma.$transaction(async (tx) => {
      // Deactivate all existing deals for this venue
      await tx.deal.updateMany({
        where: {
          venueId,
        },
        data: { isActive: false, featured: false },
      })

      // Create new deal as active and featured
      return await tx.deal.create({
        data: {
          venueId,
          type,
          title: title.trim(),
          description: description.trim(),
          eligibilityJson: eligibilityJson || null,
          isActive: true,
          featured: true, // Active deals are automatically featured
        },
      })
    })

    return NextResponse.json({ deal }, { status: 201 })
  } catch (error) {
    console.error("Error creating deal:", error)
    return NextResponse.json(
      { error: "Failed to create deal" },
      { status: 500 }
    )
  }
}
