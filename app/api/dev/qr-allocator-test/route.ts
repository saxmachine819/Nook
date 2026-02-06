import { NextResponse } from "next/server"
import {
  getUnregisteredAvailableCount,
  ensureInventory,
  allocateOneQrAsset,
} from "@/lib/qr-asset-allocator"

/**
 * Dev-only endpoint to test the QR asset allocator locally.
 * GET /api/dev/qr-allocator-test
 * Returns 404 in production.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 })
  }

  try {
    const before = await getUnregisteredAvailableCount()
    await ensureInventory(30, 100)
    const afterEnsure = await getUnregisteredAvailableCount()
    const allocated = await allocateOneQrAsset()
    const afterAlloc = await getUnregisteredAvailableCount()

    return NextResponse.json({
      getUnregisteredAvailableCount: before,
      afterEnsureInventory: afterEnsure,
      allocated: {
        id: allocated.id,
        token: allocated.token,
        reservedOrderId: allocated.reservedOrderId,
      },
      afterAllocate: afterAlloc,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: "Allocator test failed", details: message },
      { status: 500 }
    )
  }
}
