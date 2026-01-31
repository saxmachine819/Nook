import React from "react"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/venue-auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { VenuesClient } from "./VenuesClient"

async function getVenues(searchQuery?: string) {
  try {
    // Build where clause for search
    const whereClause: any = {}
    if (searchQuery && searchQuery.trim().length > 0) {
      whereClause.OR = [
        { name: { contains: searchQuery.trim(), mode: "insensitive" as const } },
        { address: { contains: searchQuery.trim(), mode: "insensitive" as const } },
      ]
    }

    // Fetch venues with owner information
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
    return venues.map((venue) => ({
      id: venue.id,
      name: venue.name,
      address: venue.address,
      status: venue.status,
      onboardingStatus: venue.onboardingStatus,
      createdAt: venue.createdAt.toISOString(),
      ownerEmail: venue.owner?.email || null,
      ownerName: venue.owner?.name || null,
    }))
  } catch (error) {
    console.error("Error fetching venues:", error)
    return []
  }
}

export default async function AdminVenuesPage({
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

  // Fetch venues with optional search
  const searchQuery = searchParams?.search || ""
  const venues = await getVenues(searchQuery)

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Venues</h1>
            <p className="text-sm text-muted-foreground">
              Manage all venues in the system
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin">Back to Admin</Link>
          </Button>
        </div>
      </div>

      <VenuesClient initialVenues={venues} initialSearchQuery={searchQuery} />
    </div>
  )
}
