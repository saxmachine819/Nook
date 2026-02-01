const { prisma } = require("../lib/prisma")
const nodeCrypto = require("crypto")

/**
 * Generate a random URL-safe token (8-12 characters)
 */
function generateToken() {
  const length = 8 + Math.floor(Math.random() * 5) // 8-12 chars
  return nodeCrypto
    .randomBytes(Math.ceil(length * 0.75))
    .toString("base64")
    .replace(/[+/=]/g, "")
    .substring(0, length)
}

async function main() {
  try {
    // Generate a unique token
    let token
    let attempts = 0
    const maxAttempts = 10

    do {
      token = generateToken()
      const existing = await prisma.qRAsset.findUnique({
        where: { token },
      })
      if (!existing) break
      attempts++
    } while (attempts < maxAttempts)

    if (attempts >= maxAttempts) {
      console.error("Failed to generate unique token after", maxAttempts, "attempts")
      process.exit(1)
    }

    // Create QR asset with UNREGISTERED status
    const qrAsset = await prisma.qRAsset.create({
      data: {
        token,
        status: "UNREGISTERED",
      },
    })

    console.log("\n✅ QR Asset Created Successfully!")
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
    console.error("Error creating QR asset:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
