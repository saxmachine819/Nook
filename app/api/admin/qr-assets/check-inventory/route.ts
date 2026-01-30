import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/venue-auth"
import {
  getUnregisteredAvailableCount,
  ensureInventory,
} from "@/lib/qr-asset-allocator"

const LOW_WATER = 30
const REPLENISH_COUNT = 100

export async function POST() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to check inventory." },
        { status: 401 }
      )
    }
    if (!isAdmin(session.user)) {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 403 }
      )
    }

    const availableBefore = await getUnregisteredAvailableCount()
    await ensureInventory(LOW_WATER, REPLENISH_COUNT)
    const availableAfter = await getUnregisteredAvailableCount()

    const replenished = availableAfter > availableBefore
    const created = availableAfter - availableBefore

    return NextResponse.json(
      {
        availableBefore,
        availableAfter,
        replenished,
        created,
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Error checking inventory:", error)
    const message =
      error instanceof Error ? error.message : "Failed to check inventory."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
