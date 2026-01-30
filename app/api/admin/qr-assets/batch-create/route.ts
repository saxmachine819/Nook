import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/venue-auth"
import { randomBytes, randomUUID } from "crypto"

/**
 * Generates a random URL-safe token of length between 8-12 characters.
 * Uses cryptographically secure random bytes.
 */
function generateToken(): string {
  // Random length between 8-12
  const length = Math.floor(Math.random() * 5) + 8

  // Generate random bytes (more than needed for base64 conversion)
  // Base64 encoding produces ~4/3 the length, so we need ceil(length * 3/4) bytes
  const bytes = randomBytes(Math.ceil(length * 0.75))

  // Convert to base64url (URL-safe base64)
  let token = bytes
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")

  // Trim to desired length
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
    // Generate tokens in batches
    const batchSize = Math.min(count - tokens.size, 1000)
    const candidateTokens: string[] = []

    for (let i = 0; i < batchSize * 2; i++) {
      // Generate extra tokens to account for potential collisions
      candidateTokens.push(generateToken())
    }

    // Check for existing tokens in database
    const existingTokens = await prisma.qRAsset.findMany({
      where: {
        token: {
          in: candidateTokens,
        },
      },
      select: {
        token: true,
      },
    })

    const existingTokenSet = new Set(existingTokens.map((t) => t.token))

    // Add only unique tokens (not in database, not already in our set)
    for (const token of candidateTokens) {
      if (!existingTokenSet.has(token) && !tokens.has(token)) {
        tokens.add(token)
        if (tokens.size >= count) {
          break
        }
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
    // Require authentication
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to create QR assets." },
        { status: 401 }
      )
    }

    // Check admin access
    if (!isAdmin(session.user)) {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json().catch(() => ({}))
    let count = body.count

    // Default to 100 if not provided
    if (count === undefined || count === null) {
      count = 100
    }

    // Validate count parameter
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

    // Generate unique tokens
    const tokens = await generateUniqueTokens(count)

    // Generate batch ID (UUID for tracking)
    const batchId = randomUUID()

    // Batch insert into database
    const result = await prisma.qRAsset.createMany({
      data: tokens.map((token) => ({
        token,
        status: "UNREGISTERED",
        batchId,
      })),
      skipDuplicates: true, // Safety net for edge cases
    })

    // Return response with sample tokens (first 5)
    return NextResponse.json(
      {
        created: result.count,
        batchId,
        sampleTokens: tokens.slice(0, 5),
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error("Error batch-creating QR assets:", error)

    const errorMessage =
      error?.message || "Failed to create QR assets. Please try again."

    return NextResponse.json(
      {
        error: errorMessage,
        details:
          process.env.NODE_ENV === "development" ? error?.message : undefined,
      },
      { status: 500 }
    )
  }
}
