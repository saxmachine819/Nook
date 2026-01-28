import React from "react"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/venue-auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { UsersClient } from "./UsersClient"

async function getUsers(searchQuery?: string) {
  try {
    // Build where clause for search
    const whereClause: any = {}
    if (searchQuery && searchQuery.trim().length > 0) {
      whereClause.OR = [
        { email: { contains: searchQuery.trim(), mode: "insensitive" as const } },
        { name: { contains: searchQuery.trim(), mode: "insensitive" as const } },
      ]
    }

    // First, check total user count for debugging
    const totalUserCount = await prisma.user.count()
    console.log(`[Admin Users] Total users in database: ${totalUserCount}`)

    // Fetch users with related data
    // Note: User model doesn't have createdAt field, so we'll set it to null
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
      // Order by id since we don't have createdAt
      orderBy: {
        id: "desc",
      },
    })

    console.log(`[Admin Users] Query returned ${users.length} users (search: "${searchQuery}")`)
    
    if (users.length === 0) {
      console.log(`[Admin Users] No users found, returning empty array`)
      return []
    }

    // Get reservation counts for all users in parallel
    const userIds = users.map((u) => u.id)
    console.log(`[Admin Users] Getting reservation counts for user IDs:`, userIds)
    
    let reservationCounts: number[]
    try {
      reservationCounts = await Promise.all(
        userIds.map((userId) =>
          prisma.reservation.count({
            where: { userId },
          })
        )
      )
      console.log(`[Admin Users] Reservation counts retrieved:`, reservationCounts)
    } catch (countError) {
      console.error(`[Admin Users] Error getting reservation counts:`, countError)
      // Use zeros as fallback
      reservationCounts = new Array(users.length).fill(0)
    }

    console.log(`[Admin Users] Found ${users.length} users in database`)
    if (users.length > 0) {
      console.log(`[Admin Users] First user sample:`, {
        id: users[0].id,
        name: users[0].name,
        email: users[0].email,
        venuesCount: users[0].venues.length,
        reservationsCount: reservationCounts[0],
      })
    }

    // Transform users with computed fields
    const transformedUsers: any[] = []
    for (let index = 0; index < users.length; index++) {
      const user = users[index]
      try {
        const venuesOwnedCount = user.venues.length
        const reservationsCount = reservationCounts[index] || 0
        const lastReservationAt = user.reservations.length > 0 
          ? user.reservations[0].createdAt 
          : null

        // User model doesn't have createdAt, so we'll use null or a placeholder
        // In the future, we could add createdAt to the User model or use first account creation
        const createdAt = null // User model doesn't have createdAt field

        // Ensure all values are serializable
        const transformed = {
          id: String(user.id),
          name: user.name ? String(user.name) : null,
          email: user.email ? String(user.email) : null,
          createdAt: createdAt, // Will be null for now
          isAdmin: Boolean(isAdmin(user)),
          venuesOwnedCount: Number(venuesOwnedCount),
          reservationsCount: Number(reservationsCount),
          lastReservationAt: lastReservationAt 
            ? (lastReservationAt instanceof Date ? lastReservationAt.toISOString() : String(lastReservationAt))
            : null,
        }
        
        console.log(`[Admin Users] Transformed user ${index}:`, transformed)
        transformedUsers.push(transformed)
      } catch (transformError) {
        console.error(`[Admin Users] Error transforming user ${index}:`, transformError, user)
        // Skip this user but continue with others
      }
    }

    console.log(`[Admin Users] Returning ${transformedUsers.length} transformed users`)
    
    // Verify serialization
    try {
      const serialized = JSON.stringify(transformedUsers)
      console.log(`[Admin Users] Successfully serialized ${transformedUsers.length} users (${serialized.length} bytes)`)
    } catch (serializeError) {
      console.error("[Admin Users] Serialization error:", serializeError)
      console.error("[Admin Users] Problematic data:", transformedUsers)
    }
    
    return transformedUsers
  } catch (error) {
    console.error("Error fetching users:", error)
    if (error instanceof Error) {
      console.error("Error stack:", error.stack)
    }
    return []
  }
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { search?: string }
}) {
  const session = await auth()

  // Check if user is authenticated and is an admin
  if (!session?.user || !isAdmin(session.user)) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Not authorized</CardTitle>
              <CardDescription>
                You do not have permission to access this page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/">Go to Home</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Fetch users with optional search
  const searchQuery = searchParams?.search || ""
  let users = await getUsers(searchQuery)

  console.log(`[Admin Users Page] After getUsers() call: ${users.length} users`)
  console.log(`[Admin Users Page] Users array:`, users)
  
  // Verify the data before passing to client
  if (users.length > 0) {
    console.log(`[Admin Users Page] First user before passing to client:`, users[0])
    try {
      const testSerialization = JSON.stringify(users)
      console.log(`[Admin Users Page] Full users array serializes successfully (${testSerialization.length} bytes)`)
      console.log(`[Admin Users Page] First 500 chars:`, testSerialization.substring(0, 500))
    } catch (e) {
      console.error(`[Admin Users Page] Serialization test failed:`, e)
      users = [] // Clear if serialization fails
    }
  } else {
    console.warn(`[Admin Users Page] WARNING: users array is empty after getUsers()!`)
    console.warn(`[Admin Users Page] This means getUsers() returned an empty array`)
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
            <p className="text-sm text-muted-foreground">
              View and manage user accounts
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin">Back to Admin</Link>
          </Button>
        </div>
      </div>

      <UsersClient 
        initialUsers={users.length > 0 ? users : []} 
        initialSearchQuery={searchQuery} 
      />
    </div>
  )
}
