import { notFound } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditVenue } from "@/lib/venue-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { VenueEditClient } from "./VenueEditClient"

interface VenueEditPageProps {
  params: { id: string }
}

export default async function VenueDashboardEditPage({ params }: VenueEditPageProps) {
  const session = await auth()

  if (!session?.user?.id) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Edit venue</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You must be signed in to edit a venue.
            </p>
            <Button asChild className="mt-4">
              <Link href={`/profile?callbackUrl=/venue/dashboard/${params.id}/edit`}>
                Sign in
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const venue = await prisma.venue.findUnique({
    where: { id: params.id },
    include: {
      tables: {
        include: {
          seats: true,
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

  if (!canEditVenue(session.user, venue)) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Edit venue</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Permission denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You don&apos;t have permission to edit this venue.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <VenueEditClient venue={venue} />
}
