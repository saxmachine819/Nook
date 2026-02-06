import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/venue-auth"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to view QR assets." },
        { status: 401 }
      )
    }
    if (!isAdmin(session.user)) {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10) || 20))
    const status = searchParams.get("status") ?? undefined
    const venueId = searchParams.get("venueId") ?? undefined
    const batchId = searchParams.get("batchId") ?? undefined
    const reservedParam = searchParams.get("reserved") ?? undefined
    const scannedOnly = searchParams.get("scannedOnly") === "true"

    const where: Record<string, unknown> = {}
    if (status && ["UNREGISTERED", "ACTIVE", "RETIRED"].includes(status)) {
      where.status = status
    }
    if (venueId) where.venueId = venueId
    if (batchId) where.batchId = batchId
    if (reservedParam === "true") where.reservedOrderId = { not: null }
    else if (reservedParam === "false") where.reservedOrderId = null

    if (scannedOnly) {
      const scannedTokens = await prisma.qREvent
        .groupBy({
          by: ["token"],
          where: { eventType: "scan" },
        })
        .then((rows) => rows.map((r) => r.token))
      where.token = scannedTokens.length > 0 ? { in: scannedTokens } : { in: [] }
    }

    const now = Date.now()
    const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)

    const [availableUnregistered, reservedForOrders, activeCount, retiredCount, scansLast24h, scansLast7d, total, items] =
      await Promise.all([
        prisma.qRAsset.count({
          where: { status: "UNREGISTERED", reservedOrderId: null },
        }),
        prisma.qRAsset.count({
          where: { reservedOrderId: { not: null } },
        }),
        prisma.qRAsset.count({
          where: { status: "ACTIVE" },
        }),
        prisma.qRAsset.count({
          where: { status: "RETIRED" },
        }),
        prisma.qREvent.count({
          where: { eventType: "scan", createdAt: { gte: twentyFourHoursAgo } },
        }),
        prisma.qREvent.count({
          where: { eventType: "scan", createdAt: { gte: sevenDaysAgo } },
        }),
        prisma.qRAsset.count({ where }),
        prisma.qRAsset.findMany({
          where,
          include: {
            venue: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ])

    const summary = {
      availableUnregistered,
      reservedForOrders,
      active: activeCount,
      retired: retiredCount,
      scansLast24h,
      scansLast7d,
    }

    const lastScannedMap = new Map<string, Date>()
    if (items.length > 0) {
      const tokens = items.map((i) => i.token)
      const lastScannedRows = await prisma.qREvent.groupBy({
        by: ["token"],
        where: { eventType: "scan", token: { in: tokens } },
        _max: { createdAt: true },
      })
      for (const row of lastScannedRows) {
        if (row._max.createdAt) lastScannedMap.set(row.token, row._max.createdAt)
      }
    }

    const itemsPayload = items.map((a) => ({
      id: a.id,
      token: a.token,
      status: a.status,
      batchId: a.batchId,
      venueId: a.venueId,
      venue: a.venue ? { id: a.venue.id, name: a.venue.name } : null,
      resourceType: a.resourceType,
      resourceId: a.resourceId,
      reservedOrderId: a.reservedOrderId,
      createdAt: a.createdAt.toISOString(),
      activatedAt: a.activatedAt?.toISOString() ?? null,
      activatedBy: a.activatedBy ?? null,
      activationSource: a.activationSource ?? null,
      retiredAt: a.retiredAt?.toISOString() ?? null,
      lastScannedAt: lastScannedMap.get(a.token)?.toISOString() ?? null,
    }))

    return NextResponse.json(
      { summary, items: itemsPayload, total, page, pageSize },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Error fetching admin QR assets:", error)
    const message = error instanceof Error ? error.message : "Failed to fetch QR assets."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
