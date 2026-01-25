import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditVenue } from "@/lib/venue-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { VenueOpsConsoleClient } from "./VenueOpsConsoleClient"

interface VenueOpsConsolePageProps {
  params: { id: string }
}

export default async function VenueOpsConsolePage({ params }: VenueOpsConsolePageProps) {
  const session = await auth()

  if (!session?.user?.id) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Venue Operations</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You must be signed in to access the venue operations console.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Fetch venue with tables and seats
  const venue = await prisma.venue.findUnique({
    where: { id: params.id },
    include: {
      tables: {
        include: {
          seats: {
            orderBy: {
              position: "asc",
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  })

  if (!venue) {
    notFound()
  }

  // Check authorization
  if (!canEditVenue(session.user, venue)) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Venue Operations</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Permission denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You don&apos;t have permission to access this venue&apos;s operations console.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const now = new Date()

  // Fetch all reservations, seat blocks, and deals
  const [reservations, seatBlocks, dealsResult] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        venueId: venue.id,
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
        seat: {
          include: {
            table: {
              select: {
                name: true,
              },
            },
          },
        },
        table: {
          select: {
            name: true,
            seatCount: true,
          },
        },
      },
      orderBy: {
        startAt: "asc",
      },
    }),
    prisma.seatBlock.findMany({
      where: {
        venueId: venue.id,
      },
      orderBy: {
        startAt: "asc",
      },
    }),
    prisma.deal.findMany({
      where: {
        venueId: venue.id,
      },
      orderBy: [
        { featured: "desc" },
        { createdAt: "desc" },
      ],
    }).catch((error) => {
      console.error("Error fetching deals:", error)
      return []
    }),
  ])
  
  const deals = dealsResult || []

  return (
    <VenueOpsConsoleClient
      venue={venue}
      reservations={reservations}
      seatBlocks={seatBlocks}
      deals={deals}
      now={now.toISOString()}
    />
  )
}
