import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditVenue, isAdmin } from "@/lib/venue-auth"
import { allocateOneQrAsset } from "@/lib/qr-asset-allocator"

// Supports seat, table, area, and venue-level QR. Venue QR: resourceType=venue, resourceId=null, one active per venue.

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to allocate and assign QR assets." },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { venueId, resourceType, resourceId } = body as {
      venueId?: string
      resourceType?: string
      resourceId?: string
    }

    if (!venueId || !resourceType) {
      return NextResponse.json(
        { error: "Missing required fields: venueId and resourceType are required" },
        { status: 400 }
      )
    }

    if (!["seat", "table", "area", "venue"].includes(resourceType)) {
      return NextResponse.json(
        { error: "resourceType must be 'seat', 'table', 'area', or 'venue'" },
        { status: 400 }
      )
    }

    if (resourceType !== "area" && resourceType !== "venue" && !resourceId) {
      return NextResponse.json(
        { error: `resourceId is required for resourceType '${resourceType}'` },
        { status: 400 }
      )
    }

    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, ownerId: true },
    })

    if (!venue) {
      return NextResponse.json(
        { error: "Venue not found" },
        { status: 404 }
      )
    }

    if (!isAdmin(session.user) && !canEditVenue(session.user, venue)) {
      return NextResponse.json(
        { error: "You do not have permission to manage this venue" },
        { status: 403 }
      )
    }

    if (resourceType === "seat" && resourceId) {
      const seat = await prisma.seat.findUnique({
        where: { id: resourceId },
        include: {
          table: { select: { id: true, venueId: true } },
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
        select: { id: true, venueId: true },
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

    const existing = await prisma.qRAsset.findFirst({
      where: {
        venueId,
        resourceType,
        resourceId: resourceId ?? null,
        status: "ACTIVE",
      },
      select: { id: true, token: true, status: true },
    })

    if (existing) {
      return NextResponse.json(
        {
          token: existing.token,
          qrAssetId: existing.id,
          status: existing.status,
          alreadyExisted: true,
        },
        { status: 200 }
      )
    }

    const allocated = await allocateOneQrAsset()
    const activatedBy = session.user?.id ?? session.user?.email ?? null
    const updated = await prisma.qRAsset.update({
      where: { id: allocated.id },
      data: {
        status: "ACTIVE",
        venueId,
        resourceType,
        resourceId: resourceId ?? null,
        activatedAt: new Date(),
        activatedBy,
        activationSource: "venue_print",
        reservedOrderId: null,
      },
      select: { id: true, token: true, status: true },
    })

    return NextResponse.json(
      {
        token: updated.token,
        qrAssetId: updated.id,
        status: updated.status,
        alreadyExisted: false,
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Error allocating and assigning QR asset:", error)
    const message = error instanceof Error ? error.message : "Failed to allocate and assign QR asset."
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
