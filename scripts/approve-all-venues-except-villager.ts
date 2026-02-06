/**
 * Script to approve all venues except "Villager"
 * 
 * This sets onboardingStatus to APPROVED for all venues except those named "Villager"
 * Useful for testing the approval workflow.
 * 
 * Usage: npx tsx scripts/approve-all-venues-except-villager.ts
 */

import { prisma } from "../lib/prisma"

async function approveAllVenuesExceptVillager() {
  console.log("🔄 Approving all venues except 'Villager'...\n")

  try {
    // Get all venues
    const allVenues = await prisma.venue.findMany({
      select: {
        id: true,
        name: true,
        onboardingStatus: true,
      },
      orderBy: {
        name: "asc",
      },
    })

    console.log(`📊 Found ${allVenues.length} venues\n`)

    let approvedCount = 0
    let skippedCount = 0

    for (const venue of allVenues) {
      if (venue.name === "Villager") {
        console.log(`⏭️  Skipping "${venue.name}" (${venue.id}) - keeping current status: ${venue.onboardingStatus}`)
        skippedCount++
        continue
      }

      await prisma.venue.update({
        where: { id: venue.id },
        data: {
          onboardingStatus: "APPROVED",
          approvedAt: new Date(),
          rejectedAt: null,
          rejectionReason: null,
        },
      })

      console.log(`✅ Approved "${venue.name}" (${venue.id})`)
      approvedCount++
    }

    console.log(`\n📊 Summary:`)
    console.log(`  ✅ Approved: ${approvedCount}`)
    console.log(`  ⏭️  Skipped (Villager): ${skippedCount}`)
    console.log(`\n✅ Done! All venues except "Villager" are now APPROVED.`)
    console.log(`   "Villager" will remain in its current status for testing.`)
  } catch (error: any) {
    console.error("❌ Failed:", error)
    throw error
  }
}

approveAllVenuesExceptVillager()
  .catch((error) => {
    console.error("Fatal error:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
