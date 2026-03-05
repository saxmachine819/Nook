import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/venue-auth"
import { randomBytes, randomUUID } from "crypto"

const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000 // 5 minutes

const idempotencyStore = new Map<
  string,
  { response: object; expiresAt: number }
>()

function pruneIdempotencyStore() {
  const now = Date.now()
  for (const [key, entry] of idempotencyStore.entries()) {
    if (entry.expiresAt <= now) idempotencyStore.delete(key)
  }
}

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
      where: { token: { in: candidateTokens } },
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

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to create manufacturing batch." },
        { status: 401 }
      )
    }

    if (!isAdmin(session.user)) {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    let count = body.count
    if (count === undefined || count === null) {
      count = 100
    }

    if (typeof count !== "number") {
      return NextResponse.json(
        { error: "count must be a number" },
        { status: 400 }
      )
    }
    if (!Number.isInteger(count) || count < 10) {
      return NextResponse.json(
        { error: "count must be an integer between 10 and 5000" },
        { status: 400 }
      )
    }
    if (count > 5000) {
      return NextResponse.json(
        { error: "count cannot exceed 5000" },
        { status: 400 }
      )
    }

    const rawLabel = body.label
    const label =
      rawLabel != null && typeof rawLabel === "string"
        ? rawLabel.trim().slice(0, 500) || null
        : null

    const idempotencyKey =
      typeof body.idempotencyKey === "string"
        ? body.idempotencyKey.trim()
        : undefined

    if (idempotencyKey) {
      pruneIdempotencyStore()
      const cached = idempotencyStore.get(idempotencyKey)
      if (cached && cached.expiresAt > Date.now()) {
        return NextResponse.json(cached.response, { status: 200 })
      }
    }

    const batchId = randomUUID()
    const tokens = await generateUniqueTokens(count)
    const reservedOrderId = `manufacturing-${batchId}`

    const result = await prisma.qRAsset.createMany({
      data: tokens.map((token) => ({
        token,
        status: "UNREGISTERED",
        batchId,
        batchLabel: label,
        reservedOrderId,
      })),
      skipDuplicates: true,
    })

    const response = {
      created: result.count,
      batchId,
      batchLabel: label,
      sampleTokens: tokens.slice(0, 5),
    }

    if (idempotencyKey) {
      idempotencyStore.set(idempotencyKey, {
        response,
        expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
      })
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error: unknown) {
    console.error("Error creating manufacturing batch:", error)
    const message =
      error instanceof Error ? error.message : "Failed to create manufacturing batch. Please try again."
    return NextResponse.json(
      {
        error: message,
        details: process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}
