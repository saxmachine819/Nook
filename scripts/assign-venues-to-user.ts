import { prisma } from "../lib/prisma"

async function assignVenuesToUser() {
  const userEmail = "saxmachine819@gmail.com"

  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    })

    if (!user) {
      console.error(`User with email ${userEmail} not found`)
      process.exit(1)
    }

    console.log(`Found user: ${user.id} (${user.email})`)

    // Find all venues without an owner
    const venuesWithoutOwner = await prisma.venue.findMany({
      where: { ownerId: null },
      select: { id: true, name: true },
    })

    console.log(`Found ${venuesWithoutOwner.length} venues without an owner`)

    if (venuesWithoutOwner.length === 0) {
      console.log("No venues to assign")
      return
    }

    // Update all venues to assign them to this user
    const result = await prisma.venue.updateMany({
      where: { ownerId: null },
      data: { ownerId: user.id },
    })

    console.log(`✅ Successfully assigned ${result.count} venues to ${userEmail}`)
    console.log("\nAssigned venues:")
    venuesWithoutOwner.forEach((v) => {
      console.log(`  - ${v.name} (${v.id})`)
    })
  } catch (error) {
    console.error("Error assigning venues:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

assignVenuesToUser()
