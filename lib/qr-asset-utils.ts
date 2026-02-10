import { prisma } from "@/lib/prisma"

/**
 * Returns the base URL for QR code links (e.g. https://nooc.io).
 * Resolution order: NEXT_PUBLIC_APP_URL → request host → NEXTAUTH_URL → localhost.
 *
 * @param request - Optional request with headers (for host, x-forwarded-proto)
 */
export function getQRBaseUrl(
  request?: { headers: { get: (k: string) => string | null } }
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (appUrl) {
    return appUrl.replace(/\/$/, "")
  }

  const host =
    request?.headers?.get("host") ||
    process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, "") ||
    "localhost:3000"
  const protocol =
    request?.headers?.get("x-forwarded-proto") ||
    (host.includes("localhost") ? "http" : "https")
  return `${protocol}://${host}`
}

/**
 * Validates the format of a QR asset token.
 * 
 * Token format requirements:
 * - Non-empty string
 * - Length between 16 and 64 characters
 * - Contains only URL-safe characters (alphanumeric, hyphens, underscores)
 * 
 * @param token - The token string to validate
 * @returns true if token format is valid, false otherwise
 */
export function validateTokenFormat(token: string): boolean {
  if (!token || typeof token !== "string") {
    return false
  }

  const trimmedToken = token.trim()
  
  // Check length (16-64 characters)
  if (trimmedToken.length < 16 || trimmedToken.length > 64) {
    return false
  }

  // Check for URL-safe characters only (alphanumeric, hyphens, underscores)
  // This regex matches: letters (a-z, A-Z), numbers (0-9), hyphens (-), and underscores (_)
  const urlSafeRegex = /^[a-zA-Z0-9_-]+$/
  if (!urlSafeRegex.test(trimmedToken)) {
    return false
  }

  return true
}

/**
 * Fetches a QR asset by its token.
 * 
 * @param token - The unique token string
 * @returns The QR asset if found, null if not found
 * @throws Error if token format is invalid or database query fails
 */
export async function getQRAssetByToken(token: string) {
  // Validate token format first
  if (!validateTokenFormat(token)) {
    throw new Error("Invalid token format")
  }

  try {
    const qrAsset = await prisma.qRAsset.findUnique({
      where: {
        token: token.trim(),
      },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
    })

    return qrAsset
  } catch (error: any) {
    console.error("Error fetching QR asset by token:", error)
    throw new Error(`Failed to fetch QR asset: ${error?.message || "Unknown error"}`)
  }
}

/**
 * Looks up a QR asset by token without strict format validation.
 * Used for scanning QR codes (tokens may be 8-12 chars, shorter than validation requires).
 * 
 * @param token - The unique token string (8-12 chars allowed)
 * @returns The QR asset if found, null if not found
 * @throws Error if database query fails
 */
export async function lookupQRAssetByToken(token: string) {
  if (!token || typeof token !== "string") {
    return null
  }

  const trimmed = token.trim()
  try {
    // Try exact match first (preserves unique index use)
    let qrAsset = await prisma.qRAsset.findUnique({
      where: { token: trimmed },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
            address: true,
            ownerId: true,
          },
        },
      },
    })
    // If not found, try case-insensitive match (QR scanners/URLs may alter case)
    if (!qrAsset) {
      qrAsset = await prisma.qRAsset.findFirst({
        where: {
          token: { equals: trimmed, mode: "insensitive" },
        },
        include: {
          venue: {
            select: {
              id: true,
              name: true,
              address: true,
              ownerId: true,
            },
          },
        },
      })
    }

    return qrAsset
  } catch (error: any) {
    console.error("Error looking up QR asset by token:", error)
    throw new Error(`Failed to lookup QR asset: ${error?.message || "Unknown error"}`)
  }
}

/**
 * Fetches venue resources (seats/tables) for QR registration.
 * Returns structured data for form dropdowns.
 * 
 * @param venueId - The venue ID
 * @returns Object with seats and tables arrays
 */
export async function getVenueResources(venueId: string) {
  try {
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      include: {
        tables: {
          include: {
            seats: {
              select: {
                id: true,
                label: true,
                name: true,
                position: true,
              },
              orderBy: { position: "asc" },
            },
          },
        },
      },
    })

    if (!venue) {
      return { seats: [], tables: [] }
    }

    // Safety check: ensure tables array exists
    if (!venue.tables || !Array.isArray(venue.tables)) {
      return { seats: [], tables: [] }
    }

    // Flatten seats from all tables - only include seats from individual tables (case-insensitive)
    const seats = venue.tables
      .filter((table) => String(table.bookingMode || "individual").toLowerCase() === "individual")
      .flatMap((table) => {
        // Safety check: ensure seats array exists
        if (!table.seats || !Array.isArray(table.seats)) {
          return []
        }
        
        return table.seats.map((seat) => {
          // Prioritize label (most common), then name, then position, fallback to generic
          const seatDisplayName = seat.label || seat.name || (seat.position ? `Seat ${seat.position}` : "Seat")
          const tableDisplayName = table.name || `Table`
          
          return {
            id: seat.id,
            name: seatDisplayName,
            tableId: table.id,
            tableName: tableDisplayName,
          }
        })
      })

    // Format tables - include booking mode, all tables can be assigned (both group and individual)
    const tables = venue.tables.map((table) => ({
      id: table.id,
      name: table.name || `Table ${table.id.slice(0, 8)}`,
      seatCount: table.seatCount,
      bookingMode: table.bookingMode || "individual", // Include booking mode
    }))

    return { seats, tables }
  } catch (error: any) {
    console.error("Error fetching venue resources:", error)
    throw new Error(`Failed to fetch venue resources: ${error?.message || "Unknown error"}`)
  }
}
