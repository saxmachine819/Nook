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
        { error: "You must be signed in to retire QR assets." },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const { token } = body as {
      token?: string
    }

    // Validate required fields
    if (!token) {
      return NextResponse.json(
        { error: "Missing required field: token" },
        { status: 400 }
      )
    }

    // Verify QR asset exists
    const qrAsset = await prisma.qRAsset.findUnique({
      where: { token: token.trim() },
      include: {
        venue: {
          select: {
            id: true,
            ownerId: true,
          },
        },
      },
    })

    if (!qrAsset) {
      return NextResponse.json(
        { error: "QR asset not found" },
        { status: 404 }
      )
    }

    // Verify QR asset has venueId (must be assigned)
    if (!qrAsset.venueId || !qrAsset.venue) {
      return NextResponse.json(
        { error: "QR asset must be assigned to a venue before it can be retired" },
        { status: 400 }
      )
    }

    // Verify user has permission to manage this venue
    if (!isAdmin(session.user) && !canEditVenue(session.user, qrAsset.venue)) {
      return NextResponse.json(
        { error: "You do not have permission to manage this venue" },
        { status: 403 }
      )
    }

    // Update QR asset to RETIRED status
    const updatedQRAsset = await prisma.qRAsset.update({
      where: { token: token.trim() },
      data: {
        status: "RETIRED",
        retiredAt: new Date(),
        // Keep assignment fields for audit trail (venueId, resourceType, resourceId)
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
          retiredAt: updatedQRAsset.retiredAt?.toISOString(),
          venue: updatedQRAsset.venue,
        },
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error("Error retiring QR asset:", error)

    const errorMessage =
      error?.message || "Failed to retire QR asset. Please try again."

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
