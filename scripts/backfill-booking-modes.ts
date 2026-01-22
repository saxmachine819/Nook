/**
 * Backfill script: Set bookingMode and positions for existing data
 * 
 * This script:
 * 1. Sets all existing tables to "individual" booking mode
 * 2. Auto-assigns positions to existing seats (1, 2, 3... per table)
 * 
 * Usage:
 *   npx tsx scripts/backfill-booking-modes.ts
 */

import { prisma } from "../lib/prisma"

async function backfillBookingModes() {
  console.log("🔄 Starting booking mode and position backfill...")

  try {
    // Get all tables
    const tables = await prisma.table.findMany({
      include: {
        seats: {
          orderBy: {
            createdAt: "asc", // Order by creation to assign positions consistently
          },
        },
      },
    })

    console.log(`📊 Found ${tables.length} tables to process`)

    let tablesUpdated = 0
    let seatsUpdated = 0

    for (const table of tables) {
      // Update table to individual mode if not set
      if (!table.bookingMode || table.bookingMode === null) {
        await prisma.table.update({
          where: { id: table.id },
          data: { bookingMode: "individual" },
        })
        tablesUpdated++
      }

      // Assign positions to seats
      for (let i = 0; i < table.seats.length; i++) {
        const seat = table.seats[i]
        const position = i + 1 // 1-indexed positions

        if (seat.position === null || seat.position === undefined) {
          await prisma.seat.update({
            where: { id: seat.id },
            data: { position },
          })
          seatsUpdated++
        }
      }
    }

    console.log(`✅ Backfill complete:`)
    console.log(`   - Tables updated: ${tablesUpdated}`)
    console.log(`   - Seats updated: ${seatsUpdated}`)
  } catch (error) {
    console.error("❌ Error during backfill:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

backfillBookingModes()
  .then(() => {
    console.log("✨ Backfill script completed successfully")
    process.exit(0)
  })
  .catch((error) => {
    console.error("💥 Backfill script failed:", error)
    process.exit(1)
  })
