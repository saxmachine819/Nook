/**
 * Test script for the QR asset allocator.
 * Run from project root: npx tsx scripts/test-qr-allocator.ts
 *
 * Requires DATABASE_URL and a migrated DB (reservedOrderId column on qr_assets).
 */

import { prisma } from "../lib/prisma"
import {
  getUnregisteredAvailableCount,
  ensureInventory,
  allocateOneQrAsset,
} from "../lib/qr-asset-allocator"

async function main() {
  console.log("QR Asset Allocator — local test\n")

  const before = await getUnregisteredAvailableCount()
  console.log("1. getUnregisteredAvailableCount() =>", before)

  console.log("\n2. ensureInventory(30, 100) ...")
  await ensureInventory(30, 100)
  const afterEnsure = await getUnregisteredAvailableCount()
  console.log("   Available after ensure:", afterEnsure)

  console.log("\n3. allocateOneQrAsset() ...")
  const allocated = await allocateOneQrAsset()
  console.log("   Allocated asset:", {
    id: allocated.id,
    token: allocated.token,
    reservedOrderId: allocated.reservedOrderId,
  })

  const afterAlloc = await getUnregisteredAvailableCount()
  console.log("\n4. getUnregisteredAvailableCount() after allocate =>", afterAlloc)
  console.log("\nDone.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
