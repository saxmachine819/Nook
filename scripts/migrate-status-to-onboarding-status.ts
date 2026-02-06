/**
 * Migration script to migrate status field to onboardingStatus enum
 * 
 * Run this BEFORE running `npx prisma db push` or `npx prisma migrate dev`
 * 
 * This script:
 * 1. Creates the OnboardingStatus enum type
 * 2. Adds the new onboardingStatus columns
 * 3. Migrates data from status to onboardingStatus
 * 
 * After running this, you can safely run `npx prisma db push` which will drop the old status column.
 * 
 * Usage: 
 *   npx tsx scripts/migrate-status-to-onboarding-status.ts
 *   OR
 *   npx ts-node --compiler-options {\"module\":\"commonjs\"} scripts/migrate-status-to-onboarding-status.ts
 */

import { prisma } from "../lib/prisma"

async function migrateStatusToOnboardingStatus() {
  console.log("🔄 Starting migration from status to onboardingStatus...")

  try {
    // Create the enum type if it doesn't exist
    await prisma.$executeRaw`
      DO $$ BEGIN
        CREATE TYPE "OnboardingStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `
    console.log("✅ Created/verified OnboardingStatus enum")

    // Check if onboardingStatus column exists
    const result = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'venues' 
      AND column_name = 'onboardingStatus'
    `

    if (result.length === 0) {
      // Add the new columns if they don't exist
      await prisma.$executeRaw`
        ALTER TABLE "venues" 
        ADD COLUMN "onboardingStatus" "OnboardingStatus" DEFAULT 'DRAFT',
        ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
      `
      console.log("✅ Added new onboardingStatus columns")
    } else {
      console.log("✅ onboardingStatus column already exists")
    }

    // Migrate data from status to onboardingStatus
    // This will update venues that have status but onboardingStatus is NULL or different
    const statusMapping: Record<string, "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED"> = {
      draft: "DRAFT",
      submitted: "SUBMITTED",
      approved: "APPROVED",
      published: "APPROVED", // Map published to approved
      rejected: "REJECTED",
    }

    // Get all venues with their current status values
    const venues = await prisma.$queryRaw<Array<{ 
      id: string
      status: string | null
      onboardingStatus: string | null
    }>>`
      SELECT id, status, "onboardingStatus"
      FROM "venues"
    `

    console.log(`📊 Found ${venues.length} venues to check`)

    let migratedCount = 0
    let alreadyMigratedCount = 0

    for (const venue of venues) {
      // If onboardingStatus is already set, skip
      if (venue.onboardingStatus) {
        alreadyMigratedCount++
        continue
      }

      // If status exists, migrate it
      if (venue.status) {
        const oldStatus = venue.status.toLowerCase()
        const newStatus = statusMapping[oldStatus] || "DRAFT" // Default to DRAFT if unknown

        await prisma.$executeRaw`
          UPDATE "venues" 
          SET "onboardingStatus" = ${newStatus}::"OnboardingStatus"
          WHERE id = ${venue.id}
        `

        console.log(`  ✓ Migrated venue ${venue.id}: "${venue.status}" → "${newStatus}"`)
        migratedCount++
      } else {
        // No status, set to DRAFT
        await prisma.$executeRaw`
          UPDATE "venues" 
          SET "onboardingStatus" = 'DRAFT'::"OnboardingStatus"
          WHERE id = ${venue.id} AND "onboardingStatus" IS NULL
        `
        console.log(`  ✓ Set venue ${venue.id} to DRAFT (no previous status)`)
        migratedCount++
      }
    }

    console.log(`\n📊 Migration summary:`)
    console.log(`  ✓ Migrated: ${migratedCount}`)
    console.log(`  ✓ Already had onboardingStatus: ${alreadyMigratedCount}`)

    // Verify all venues have onboardingStatus set
    const venuesWithoutStatus = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "venues" WHERE "onboardingStatus" IS NULL
    `

    if (venuesWithoutStatus.length > 0) {
      console.log(`\n⚠️  Warning: ${venuesWithoutStatus.length} venues still have NULL onboardingStatus`)
      console.log("   Setting them to DRAFT...")
      
      await prisma.$executeRaw`
        UPDATE "venues" 
        SET "onboardingStatus" = 'DRAFT'::"OnboardingStatus"
        WHERE "onboardingStatus" IS NULL
      `
      console.log("   ✅ Fixed")
    }

    // Check if any venues still have the old status column with values
    const venuesWithOldStatus = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count 
      FROM "venues" 
      WHERE status IS NOT NULL AND status != ''
    `

    const count = Number(venuesWithOldStatus[0]?.count || 0)
    
    console.log(`\n✅ Data migration complete!`)
    console.log(`\n📊 Status column check:`)
    console.log(`   Venues with old 'status' values: ${count}`)
    
    if (count > 0) {
      console.log(`\n⚠️  Note: ${count} venues still have values in the old 'status' column.`)
      console.log(`   This is OK - the data has been copied to 'onboardingStatus'.`)
      console.log(`   The old column will be dropped when you run 'npx prisma db push'.`)
    } else {
      console.log(`   ✅ All venues migrated! Safe to drop 'status' column.`)
    }
    
    console.log(`\n📝 Next steps:`)
    console.log(`1. Verify migration: npx tsx scripts/verify-status-migration.ts`)
    console.log(`2. Remove 'status' field from prisma/schema.prisma`)
    console.log(`3. Run: npx prisma generate`)
    console.log(`4. Run: npx prisma db push`)
  } catch (error: any) {
    console.error("❌ Migration failed:", error)
    throw error
  }
}

migrateStatusToOnboardingStatus()
  .catch((error) => {
    console.error("Fatal error:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
