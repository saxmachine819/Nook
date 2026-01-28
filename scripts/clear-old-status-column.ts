/**
 * Script to clear the old status column values after migration is complete
 * 
 * This should be run AFTER verifying that all venues have onboardingStatus set.
 * It will NULL out the old status column so Prisma can safely drop it.
 * 
 * Usage: npx tsx scripts/clear-old-status-column.ts
 */

import { prisma } from "../lib/prisma"

async function clearOldStatusColumn() {
  console.log("🧹 Clearing old status column values...\n")

  try {
    // First verify all venues have onboardingStatus
    const venuesWithoutStatus = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count 
      FROM "venues" 
      WHERE "onboardingStatus" IS NULL
    `

    const nullCount = Number(venuesWithoutStatus[0]?.count || 0)

    if (nullCount > 0) {
      console.log(`❌ ERROR: ${nullCount} venues still have NULL onboardingStatus!`)
      console.log(`   Please run the migration script first:`)
      console.log(`   npx tsx scripts/migrate-status-to-onboarding-status.ts`)
      return
    }

    // Check how many venues have old status values
    const venuesWithOldStatus = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count 
      FROM "venues" 
      WHERE status IS NOT NULL AND status != ''
    `

    const count = Number(venuesWithOldStatus[0]?.count || 0)

    if (count === 0) {
      console.log("✅ No venues have values in the old status column.")
      console.log("   Safe to proceed with: npx prisma db push")
      return
    }

    console.log(`📊 Found ${count} venues with values in old 'status' column`)
    console.log(`   Verifying they all have onboardingStatus set...`)

    // Verify all these venues have onboardingStatus
    const venuesToCheck = await prisma.$queryRaw<Array<{ 
      id: string
      name: string
      status: string
      onboardingStatus: string | null
    }>>`
      SELECT id, name, status, "onboardingStatus"
      FROM "venues"
      WHERE status IS NOT NULL AND status != ''
    `

    const missingOnboardingStatus = venuesToCheck.filter(v => !v.onboardingStatus)
    
    if (missingOnboardingStatus.length > 0) {
      console.log(`\n❌ ERROR: ${missingOnboardingStatus.length} venues have status but NO onboardingStatus:`)
      missingOnboardingStatus.forEach(v => {
        console.log(`   - ${v.name} (${v.id}): status="${v.status}", onboardingStatus=NULL`)
      })
      console.log(`\n   Please run the migration script first:`)
      console.log(`   npx tsx scripts/migrate-status-to-onboarding-status.ts`)
      return
    }

    console.log(`✅ All ${count} venues have onboardingStatus set. Safe to clear old status values.\n`)

    // Show what will be cleared
    console.log("Venues that will be cleared:")
    venuesToCheck.forEach(v => {
      console.log(`   - ${v.name}: status="${v.status}" → onboardingStatus="${v.onboardingStatus}"`)
    })

    // Clear the old status column
    await prisma.$executeRaw`
      UPDATE "venues" 
      SET status = NULL
      WHERE status IS NOT NULL
    `

    console.log(`\n✅ Cleared old status values from ${count} venues`)
    console.log(`\n📝 Next steps:`)
    console.log(`1. Run: npx prisma generate`)
    console.log(`2. Run: npx prisma db push`)
    console.log(`   (The status column will now be dropped safely)`)
  } catch (error: any) {
    console.error("❌ Failed to clear status column:", error)
    throw error
  }
}

clearOldStatusColumn()
  .catch((error) => {
    console.error("Fatal error:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
