import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/venue-auth"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 })
    }
    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const assets = await prisma.qRAsset.findMany({
      where: {
        reservedOrderId: { startsWith: "manufacturing-" },
        batchId: { not: null },
      },
      select: {
        batchId: true,
        batchLabel: true,
        createdAt: true,
        manufacturingPng: true,
      },
      orderBy: { createdAt: "asc" },
    })

    const byBatch = new Map<
      string,
      { batchLabel: string | null; createdAt: Date; total: number; withPng: number }
    >()

    for (const a of assets) {
      const bid = a.batchId!
      if (!byBatch.has(bid)) {
        byBatch.set(bid, {
          batchLabel: a.batchLabel ?? null,
          createdAt: a.createdAt,
          total: 0,
          withPng: 0,
        })
      }
      const row = byBatch.get(bid)!
      row.total += 1
      if (a.manufacturingPng != null && a.manufacturingPng.length > 0) {
        row.withPng += 1
      }
      if (a.createdAt < row.createdAt) row.createdAt = a.createdAt
    }

    const batches = Array.from(byBatch.entries())
      .map(([batchId, row]) => ({
        batchId,
        batchLabel: row.batchLabel,
        createdAt: row.createdAt.toISOString(),
        tokenCount: row.total,
        reservedCount: row.total,
        generated: row.withPng === row.total,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    return NextResponse.json({ batches }, { status: 200 })
  } catch (error) {
    console.error("[manufacturing-batches]", error)
    const message = error instanceof Error ? error.message : "Failed to list manufacturing batches"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
