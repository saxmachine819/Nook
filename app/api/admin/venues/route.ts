import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/venue-auth"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to view venues." },
        { status: 401 }
      )
    }

    if (!isAdmin(session.user)) {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const searchQuery = searchParams.get("search")?.trim() || ""

    // Build where clause for search
    const whereClause: any = {}
    if (searchQuery.length > 0) {
      whereClause.OR = [
        { name: { contains: searchQuery, mode: "insensitive" as const } },
        { address: { contains: searchQuery, mode: "insensitive" as const } },
      ]
    }

    // Fetch venues with owner information (include deleted; UI shows deleted state)
    const venues = await prisma.venue.findMany({
      where: whereClause,
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    // Transform venues for response (include status so admin can show deleted state)
    const venuesList = venues.map((venue) => ({
      id: venue.id,
      name: venue.name,
      address: venue.address,
      status: venue.status,
      onboardingStatus: venue.onboardingStatus,
      createdAt: venue.createdAt.toISOString(),
      ownerEmail: venue.owner?.email || null,
      ownerName: venue.owner?.name || null,
    }))

    return NextResponse.json({ venues: venuesList }, { status: 200 })
  } catch (error: any) {
    console.error("Error fetching venues:", error)
    
    const errorMessage = error?.message || "Failed to fetch venues. Please try again."
    
    return NextResponse.json(
      { error: errorMessage, details: process.env.NODE_ENV === "development" ? error?.message : undefined },
      { status: 500 }
    )
  }
}
