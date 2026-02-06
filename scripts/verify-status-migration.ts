/**
 * Verification script to check if status migration completed successfully
 * 
 * Usage: npx tsx scripts/verify-status-migration.ts
 */

import { prisma } from "../lib/prisma"

async function verifyMigration() {
  console.log("🔍 Verifying status migration...\n")

  try {
    // Check if onboardingStatus column exists
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'venues' 
      AND column_name IN ('status', 'onboardingStatus')
      ORDER BY column_name
    `

    const hasStatus = columns.some(c => c.column_name === 'status')
    const hasOnboardingStatus = columns.some(c => c.column_name === 'onboardingStatus')

    console.log(`Status column exists: ${hasStatus ? '✅' : '❌'}`)
    console.log(`OnboardingStatus column exists: ${hasOnboardingStatus ? '✅' : '❌'}\n`)

    if (!hasOnboardingStatus) {
      console.log("❌ onboardingStatus column not found. Run the migration script first.")
      return
    }

    // Get all venues and check their status values
    const venues = await prisma.$queryRaw<Array<{ 
      id: string
      name: string
      status: string | null
      onboardingStatus: string | null
    }>>`
      SELECT id, name, status, "onboardingStatus"
      FROM "venues"
      ORDER BY "createdAt" DESC
    `

    console.log(`Found ${venues.length} venues\n`)

    let migratedCount = 0
    let unmigratedCount = 0
    let nullOnboardingStatus = 0

    for (const venue of venues) {
      if (!venue.onboardingStatus) {
        nullOnboardingStatus++
        console.log(`⚠️  Venue "${venue.name}" (${venue.id}): onboardingStatus is NULL`)
      } else if (venue.status && venue.status !== '') {
        unmigratedCount++
        console.log(`⚠️  Venue "${venue.name}" (${venue.id}): status="${venue.status}", onboardingStatus="${venue.onboardingStatus}"`)
      } else {
        migratedCount++
      }
    }

    console.log(`\n📊 Summary:`)
    console.log(`  ✅ Fully migrated: ${migratedCount}`)
    console.log(`  ⚠️  Has old status value: ${unmigratedCount}`)
    console.log(`  ❌ NULL onboardingStatus: ${nullOnboardingStatus}`)

    if (unmigratedCount > 0 || nullOnboardingStatus > 0) {
      console.log(`\n❌ Migration incomplete. Please run:`)
      console.log(`   npx tsx scripts/migrate-status-to-onboarding-status.ts`)
    } else {
      console.log(`\n✅ All venues have onboardingStatus set!`)
      console.log(`\n📝 Next step: Remove 'status' field from schema.prisma and run:`)
      console.log(`   npx prisma db push`)
    }
  } catch (error: any) {
    console.error("❌ Verification failed:", error)
    throw error
  }
}

verifyMigration()
  .catch((error) => {
    console.error("Fatal error:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
