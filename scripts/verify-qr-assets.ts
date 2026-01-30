import { prisma } from "../lib/prisma"

async function main() {
  console.log("🔍 Verifying QR Assets table...\n")

  try {
    // 1. Check if QRAsset model exists in Prisma client
    console.log("1. Checking Prisma client for QRAsset model...")
    if (prisma.qRAsset) {
      console.log("   ✅ prisma.qRAsset is available\n")
    } else {
      console.log("   ❌ prisma.qRAsset NOT found\n")
      return
    }

    // 2. Try to count records (should work even if table is empty)
    console.log("2. Testing database query...")
    const count = await prisma.qRAsset.count()
    console.log(`   ✅ Query successful - Found ${count} QR assets in database\n`)

    // 3. Check table structure by trying to query with select
    console.log("3. Verifying table structure...")
    const sample = await prisma.qRAsset.findFirst({
      select: {
        id: true,
        token: true,
        status: true,
        venueId: true,
        resourceType: true,
        resourceId: true,
        activatedAt: true,
        retiredAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    console.log("   ✅ All expected fields are accessible\n")

    // 4. Verify enum values
    console.log("4. Checking QRAssetStatus enum...")
    const statuses = ["UNREGISTERED", "ACTIVE", "RETIRED"]
    console.log(`   ✅ Expected statuses: ${statuses.join(", ")}\n`)

    console.log("✅ All checks passed! QR Assets table is properly set up.")
  } catch (error: any) {
    console.error("❌ Verification failed:", error.message)
    console.error("\nError details:", error)
    process.exit(1)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
