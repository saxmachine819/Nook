import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditVenue, isAdmin } from "@/lib/venue-auth"

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to reassign QR assets." },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const { token, venueId, resourceType, resourceId } = body as {
      token?: string
      venueId?: string
      resourceType?: string
      resourceId?: string
    }

    // Validate required fields
    if (!token || !venueId || !resourceType) {
      return NextResponse.json(
        { error: "Missing required fields: token, venueId, and resourceType are required" },
        { status: 400 }
      )
    }

    // Validate resourceType
    if (!["seat", "table", "area"].includes(resourceType)) {
      return NextResponse.json(
        { error: "resourceType must be 'seat', 'table', or 'area'" },
        { status: 400 }
      )
    }

    // Validate resourceId (required for seat and table, optional for area)
    if (resourceType !== "area" && !resourceId) {
      return NextResponse.json(
        { error: `resourceId is required for resourceType '${resourceType}'` },
        { status: 400 }
      )
    }

    // Verify QR asset exists and is ACTIVE (allow reassignment)
    const qrAsset = await prisma.qRAsset.findUnique({
      where: { token: token.trim() },
      select: {
        id: true,
        token: true,
        status: true,
        venueId: true,
      },
    })

    if (!qrAsset) {
      return NextResponse.json(
        { error: "QR asset not found" },
        { status: 404 }
      )
    }

    if (qrAsset.status !== "ACTIVE") {
      return NextResponse.json(
        { error: `QR asset must be ACTIVE to reassign (current status: ${qrAsset.status})` },
        { status: 409 }
      )
    }

    // Verify venue exists
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: {
        id: true,
        ownerId: true,
      },
    })

    if (!venue) {
      return NextResponse.json(
        { error: "Venue not found" },
        { status: 404 }
      )
    }

    // Verify user has permission to manage this venue
    if (!isAdmin(session.user) && !canEditVenue(session.user, venue)) {
      return NextResponse.json(
        { error: "You do not have permission to manage this venue" },
        { status: 403 }
      )
    }

    // Verify resource exists and belongs to venue (if not area)
    if (resourceType === "seat" && resourceId) {
      const seat = await prisma.seat.findUnique({
        where: { id: resourceId },
        include: {
          table: {
            select: {
              id: true,
              venueId: true,
            },
          },
        },
      })

      if (!seat) {
        return NextResponse.json(
          { error: "Seat not found" },
          { status: 404 }
        )
      }

      if (seat.table.venueId !== venueId) {
        return NextResponse.json(
          { error: "Seat does not belong to this venue" },
          { status: 400 }
        )
      }
    } else if (resourceType === "table" && resourceId) {
      const table = await prisma.table.findUnique({
        where: { id: resourceId },
        select: {
          id: true,
          venueId: true,
        },
      })

      if (!table) {
        return NextResponse.json(
          { error: "Table not found" },
          { status: 404 }
        )
      }

      if (table.venueId !== venueId) {
        return NextResponse.json(
          { error: "Table does not belong to this venue" },
          { status: 400 }
        )
      }
    }
    // For "area", no validation needed (just a string identifier)

    // Update QR asset (reassign)
    const updatedQRAsset = await prisma.qRAsset.update({
      where: { token: token.trim() },
      data: {
        venueId,
        resourceType,
        resourceId: resourceId || null,
        activatedAt: new Date(), // Update activation time
        // Keep status ACTIVE
      },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
    })

    return NextResponse.json(
      {
        success: true,
        qrAsset: {
          id: updatedQRAsset.id,
          token: updatedQRAsset.token,
          status: updatedQRAsset.status,
          venueId: updatedQRAsset.venueId,
          resourceType: updatedQRAsset.resourceType,
          resourceId: updatedQRAsset.resourceId,
          activatedAt: updatedQRAsset.activatedAt?.toISOString(),
          venue: updatedQRAsset.venue,
        },
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error("Error reassigning QR asset:", error)

    const errorMessage =
      error?.message || "Failed to reassign QR asset. Please try again."

    return NextResponse.json(
      {
        error: errorMessage,
        details:
          process.env.NODE_ENV === "development" ? error?.message : undefined,
      },
      { status: 500 }
    )
  }
}
