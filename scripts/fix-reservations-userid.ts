import { prisma } from "../lib/prisma"

async function main() {
  // Set all existing reservations' userId to null since they reference non-existent users
  const result = await prisma.reservation.updateMany({
    where: {
      userId: {
        not: null,
      },
    },
    data: {
      userId: null,
    },
  })

  console.log(`Updated ${result.count} reservations to have null userId`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
