/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

async function resolveOwnerId() {
  if (process.env.SEED_OWNER_ID) {
    return process.env.SEED_OWNER_ID
  }
  if (process.env.SEED_OWNER_EMAIL) {
    const user = await prisma.user.findUnique({
      where: { email: process.env.SEED_OWNER_EMAIL },
      select: { id: true },
    })
    return user?.id ?? null
  }
  return null
}

async function main() {
  const ownerId = await resolveOwnerId()

  const venue = await prisma.venue.create({
    data: {
      name: "Nook Test Venue",
      address: "123 Main St",
      neighborhood: "Downtown",
      city: "New York",
      state: "NY",
      zipCode: "10001",
      description: "Seeded venue for testing bookings and payouts.",
      hourlySeatPrice: 10,
      rulesText: "Please be respectful and keep noise down.",
      tags: ["wifi", "coffee", "quiet"],
      ownerId,
      tables: {
        create: [
          {
            name: "Window Table",
            bookingMode: "individual",
            seatCount: 6,
            seats: {
              create: Array.from({ length: 6 }).map((_, index) => ({
                label: `W${index + 1}`,
                position: index + 1,
                pricePerHour: 10,
              })),
            },
          },
          {
            name: "Private Booth",
            bookingMode: "group",
            seatCount: 4,
            tablePricePerHour: 40,
            seats: {
              create: Array.from({ length: 4 }).map((_, index) => ({
                label: `B${index + 1}`,
                position: index + 1,
                pricePerHour: 0,
              })),
            },
          },
        ],
      },
    },
    select: { id: true, name: true },
  })

  console.log("✅ Seeded venue:", venue)
  if (!ownerId) {
    console.log(
      "ℹ️ No owner set. Provide SEED_OWNER_ID or SEED_OWNER_EMAIL to attach a user."
    )
  }
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
