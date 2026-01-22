/**
 * Backfill script: Set seat.pricePerHour from venue.hourlySeatPrice
 * 
 * This script should be run after the Prisma migration that adds the pricePerHour field.
 * It ensures all existing seats have a pricePerHour value based on their venue's hourlySeatPrice.
 * 
 * Usage:
 *   npx tsx scripts/backfill-seat-pricing.ts
 *   OR
 *   npx ts-node --compiler-options {\"module\":\"commonjs\"} scripts/backfill-seat-pricing.ts
 */

import { prisma } from "../lib/prisma"

async function backfillSeatPricing() {
  console.log("🔄 Starting seat pricing backfill...")

  try {
    // Find all seats that need pricing backfill
    // We'll update all seats to ensure they have the correct pricePerHour
    const seats = await prisma.seat.findMany({
      include: {
        table: {
          include: {
            venue: true,
          },
        },
      },
    })

    console.log(`📊 Found ${seats.length} seats to process`)

    let updated = 0
    let skipped = 0

    for (const seat of seats) {
      const venuePrice = seat.table.venue.hourlySeatPrice

      if (venuePrice === null || venuePrice === undefined) {
        console.warn(`⚠️  Seat ${seat.id} has venue without hourlySeatPrice, skipping`)
        skipped++
        continue
      }

      // Update seat with venue's hourlySeatPrice
      await prisma.seat.update({
        where: { id: seat.id },
        data: { pricePerHour: venuePrice },
      })

      updated++
    }

    console.log(`✅ Backfill complete:`)
    console.log(`   - Updated: ${updated} seats`)
    console.log(`   - Skipped: ${skipped} seats`)
  } catch (error) {
    console.error("❌ Error during backfill:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

backfillSeatPricing()
  .then(() => {
    console.log("✨ Backfill script completed successfully")
    process.exit(0)
  })
  .catch((error) => {
    console.error("💥 Backfill script failed:", error)
    process.exit(1)
  })
