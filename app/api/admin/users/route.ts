import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/venue-auth"

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to view users." },
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

    // Get search query parameter
    const searchParams = request.nextUrl.searchParams
    const searchQuery = searchParams.get("search")?.trim() || ""

    // Build where clause for search
    const whereClause: any = {}
    if (searchQuery.length > 0) {
      whereClause.OR = [
        { email: { contains: searchQuery, mode: "insensitive" as const } },
        { name: { contains: searchQuery, mode: "insensitive" as const } },
      ]
    }

    // Fetch users with related data
    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        venues: {
          select: {
            id: true,
          },
        },
        reservations: {
          select: {
            id: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1, // Just need the most recent for lastReservationAt
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    // Get reservation counts for all users in parallel
    const userIds = users.map((u) => u.id)
    const reservationCounts = await Promise.all(
      userIds.map((userId) =>
        prisma.reservation.count({
          where: { userId },
        })
      )
    )

    // Transform users with computed fields
    const usersWithInsights = users.map((user, index) => {
      const venuesOwnedCount = user.venues.length
      const reservationsCount = reservationCounts[index]
      const lastReservationAt = user.reservations.length > 0 
        ? user.reservations[0].createdAt 
        : null

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        isAdmin: isAdmin(user),
        venuesOwnedCount,
        reservationsCount,
        lastReservationAt,
      }
    })

    return NextResponse.json({ users: usersWithInsights }, { status: 200 })
  } catch (error: any) {
    console.error("Error fetching users:", error)
    
    const errorMessage = error?.message || "Failed to fetch users. Please try again."
    
    return NextResponse.json(
      { error: errorMessage, details: process.env.NODE_ENV === "development" ? error?.message : undefined },
      { status: 500 }
    )
  }
}
