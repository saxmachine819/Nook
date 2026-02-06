import { randomBytes, randomUUID } from "crypto"
import type { QRAsset } from "@prisma/client"
import { prisma } from "@/lib/prisma"

const DEFAULT_LOW_WATER = 30
const DEFAULT_REPLENISH_COUNT = 100

/**
 * Generates a random URL-safe token of length between 8-12 characters.
 * Uses cryptographically secure random bytes.
 */
function generateToken(): string {
  const length = Math.floor(Math.random() * 5) + 8
  const bytes = randomBytes(Math.ceil(length * 0.75))
  let token = bytes
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
  return token.substring(0, length)
}

/**
 * Generates unique tokens, checking for collisions in the database.
 * Retries up to maxRetries times if collisions are found.
 */
async function generateUniqueTokens(
  count: number,
  maxRetries: number = 10
): Promise<string[]> {
  const tokens = new Set<string>()
  let attempts = 0

  while (tokens.size < count && attempts < maxRetries) {
    const batchSize = Math.min(count - tokens.size, 1000)
    const candidateTokens: string[] = []

    for (let i = 0; i < batchSize * 2; i++) {
      candidateTokens.push(generateToken())
    }

    const existingTokens = await prisma.qRAsset.findMany({
      where: {
        token: { in: candidateTokens },
      },
      select: { token: true },
    })

    const existingTokenSet = new Set(existingTokens.map((t) => t.token))

    for (const token of candidateTokens) {
      if (!existingTokenSet.has(token) && !tokens.has(token)) {
        tokens.add(token)
        if (tokens.size >= count) break
      }
    }

    attempts++
  }

  if (tokens.size < count) {
    throw new Error(
      `Failed to generate ${count} unique tokens after ${maxRetries} attempts. Generated ${tokens.size} tokens.`
    )
  }

  return Array.from(tokens).slice(0, count)
}

/**
 * Returns the count of QR assets that are unregistered and not reserved for an order.
 * Reserved tokens are for shipment/registration only and must not be allocated.
 * Used for inventory checks and replenish decisions.
 */
export async function getUnregisteredAvailableCount(): Promise<number> {
  return prisma.qRAsset.count({
    where: {
      status: "UNREGISTERED",
      reservedOrderId: null,
    },
  })
}

/**
 * Ensures at least minAvailable unregistered, unreserved assets exist.
 * If current available count is below minAvailable, creates replenishCount new assets
 * with batchId "replenish-<ISO timestamp>".
 *
 * @param minAvailable - Low-water mark; replenish if available count is below this
 * @param replenishCount - Number of new assets to create when replenishing (default 100)
 */
export async function ensureInventory(
  minAvailable: number,
  replenishCount: number = 100
): Promise<void> {
  const available = await getUnregisteredAvailableCount()
  if (available >= minAvailable) return

  const tokens = await generateUniqueTokens(replenishCount)
  const batchId = `replenish-${new Date().toISOString()}`

  await prisma.qRAsset.createMany({
    data: tokens.map((token) => ({
      token,
      status: "UNREGISTERED",
      batchId,
    })),
    skipDuplicates: true,
  })
}

export type AllocateOneQrAssetOptions = {
  lowWater?: number
  replenishCount?: number
}

/**
 * Allocates one unregistered, unreserved QR asset from inventory.
 * Ensures inventory first (replenish if below lowWater), then atomically claims one asset
 * by setting reservedOrderId to a new UUID. Caller can later set reservedOrderId to a real
 * order id or clear it when the asset is assigned.
 *
 * @param options - lowWater (default 30), replenishCount (default 100)
 * @returns The allocated asset with reservedOrderId set to allocation id
 * @throws If no asset could be allocated after replenish and retry
 */
export async function allocateOneQrAsset(
  options?: AllocateOneQrAssetOptions
): Promise<QRAsset> {
  const lowWater = options?.lowWater ?? DEFAULT_LOW_WATER
  const replenishCount = options?.replenishCount ?? DEFAULT_REPLENISH_COUNT

  await ensureInventory(lowWater, replenishCount)

  const allocationId = randomUUID()
  const maxRetries = 2

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const allocated = await prisma.$transaction(async (tx) => {
      const candidate = await tx.qRAsset.findFirst({
        where: {
          status: "UNREGISTERED",
          reservedOrderId: null,
        },
        orderBy: { createdAt: "asc" },
      })

      if (!candidate) return null

      const updated = await tx.qRAsset.updateMany({
        where: {
          id: candidate.id,
          reservedOrderId: null,
        },
        data: { reservedOrderId: allocationId },
      })

      if (updated.count === 0) return null

      return tx.qRAsset.findUniqueOrThrow({
        where: { id: candidate.id },
      })
    })

    if (allocated) return allocated

    if (attempt < maxRetries - 1) {
      await ensureInventory(lowWater, replenishCount)
    }
  }

  throw new Error(
    "Failed to allocate a QR asset: no unregistered unreserved asset available after retry."
  )
}
