/**
 * Simple script to create a single QR asset for testing
 * Run with: npx ts-node --esm scripts/create-single-qr.ts
 * 
 * Or use the API endpoint instead:
 * POST /api/admin/qr-assets/batch-create with {"count": 1}
 */

import { PrismaClient } from "@prisma/client"
import { randomBytes } from "crypto"

const prisma = new PrismaClient()

function generateToken(): string {
  const length = Math.floor(Math.random() * 5) + 8 // 8-12 chars
  const bytes = randomBytes(Math.ceil(length * 0.75))
  let token = bytes
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
  return token.substring(0, length)
}

async function main() {
  try {
    // Generate unique token
    let token: string
    let attempts = 0
    do {
      token = generateToken()
      const existing = await prisma.qRAsset.findUnique({ where: { token } })
      if (!existing) break
      attempts++
      if (attempts > 10) {
        throw new Error("Failed to generate unique token")
      }
    } while (true)

    // Create QR asset
    const qrAsset = await prisma.qRAsset.create({
      data: { token, status: "UNREGISTERED" },
    })

    console.log("\n✅ QR Asset Created!")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log(`Token: ${qrAsset.token}`)
    console.log(`Status: ${qrAsset.status}`)
    console.log(`ID: ${qrAsset.id}`)
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "")
    console.log("\n📋 Test URLs:")
    console.log(`   Public Scan: ${baseUrl}/q/${qrAsset.token}`)
    console.log(`   Register:    ${baseUrl}/q/${qrAsset.token}/register`)
    console.log("\n")
  } catch (error) {
    console.error("Error:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
