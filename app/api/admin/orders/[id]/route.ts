import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/venue-auth"

const VALID_STATUSES = ["NEW", "IN_PRODUCTION", "SHIPPED", "DELIVERED", "CANCELLED"] as const
type SignageOrderStatus = (typeof VALID_STATUSES)[number]

const TRANSITIONS: Record<SignageOrderStatus, SignageOrderStatus[]> = {
  NEW: ["IN_PRODUCTION", "SHIPPED", "CANCELLED"],
  IN_PRODUCTION: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 }
      )
    }

    if (!isAdmin(session.user)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const params = await context.params
    const id = params.id

    let body: {
      status?: string
      trackingCarrier?: string | null
      trackingNumber?: string | null
      shippedAt?: string | null
      deliveredAt?: string | null
    }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 }
      )
    }

    const order = await prisma.signageOrder.findUnique({
      where: { id },
      select: { id: true, status: true },
    })

    if (!order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      )
    }

    const currentStatus = order.status as SignageOrderStatus
    const allowed = TRANSITIONS[currentStatus]
    const requestedStatus = body.status as SignageOrderStatus | undefined

    const updates: {
      status?: SignageOrderStatus
      trackingCarrier?: string | null
      trackingNumber?: string | null
      shippedAt?: Date | null
      deliveredAt?: Date | null
    } = {}

    if (requestedStatus) {
      if (!VALID_STATUSES.includes(requestedStatus)) {
        return NextResponse.json(
          { error: `Invalid status: ${requestedStatus}.` },
          { status: 400 }
        )
      }
      if (!allowed.includes(requestedStatus)) {
        return NextResponse.json(
          { error: `Cannot transition from ${currentStatus} to ${requestedStatus}.` },
          { status: 400 }
        )
      }
      updates.status = requestedStatus

      if (requestedStatus === "SHIPPED") {
        updates.trackingCarrier = body.trackingCarrier ?? null
        updates.trackingNumber = body.trackingNumber ?? null
        updates.shippedAt = body.shippedAt ? new Date(body.shippedAt) : new Date()
      }
      if (requestedStatus === "DELIVERED") {
        updates.deliveredAt = body.deliveredAt ? new Date(body.deliveredAt) : new Date()
      }
    }

    const updated = await prisma.signageOrder.update({
      where: { id },
      data: updates,
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error("PATCH /api/admin/orders/[id] error:", err)
    return NextResponse.json(
      { error: "Failed to update order." },
      { status: 500 }
    )
  }
}
