/**
 * Seed default SignageTemplates for QR signage ordering.
 * Run after migrations: npx tsx scripts/seed-signage-templates.ts
 * Safe to run multiple times (upserts by name).
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const DEFAULT_TEMPLATES: Array<{
  name: string
  description: string | null
  category: "WINDOW" | "COUNTER" | "TABLE_TENT" | "REGISTER" | "STANDARD"
}> = [
  {
    name: "Window decal",
    description: "QR code decal for window or glass door",
    category: "WINDOW",
  },
  {
    name: "Counter sign",
    description: "Standing or counter-top sign with QR code",
    category: "COUNTER",
  },
  {
    name: "Table tent",
    description: "Table tent / tent card with QR code",
    category: "TABLE_TENT",
  },
  {
    name: "Register / Store",
    description: "Store or register area QR sign",
    category: "REGISTER",
  },
  {
    name: "Standard seat QR",
    description: "Standard QR code for seat assignment",
    category: "STANDARD",
  },
]

async function main() {
  console.log("Seeding signage templates...")
  for (const t of DEFAULT_TEMPLATES) {
    const existing = await prisma.signageTemplate.findFirst({
      where: { name: t.name },
    })
    if (existing) {
      console.log(`  Skipped (exists): ${t.name}`)
      continue
    }
    await prisma.signageTemplate.create({
      data: {
        name: t.name,
        description: t.description,
        category: t.category,
        isActive: true,
      },
    })
    console.log(`  Created: ${t.name}`)
  }
  const count = await prisma.signageTemplate.count()
  console.log(`Done. Total signage templates: ${count}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
