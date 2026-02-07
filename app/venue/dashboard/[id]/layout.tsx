import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditVenue } from "@/lib/venue-auth"
import {
  claimVenueMembershipForUser,
  getVenueRole,
  requireVenueMember,
} from "@/lib/venue-members"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { VenueRoleProvider } from "./VenueRoleProvider"

interface LayoutProps {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export default async function VenueDashboardIdLayout({ children, params }: LayoutProps) {
  const { id: venueId } = await params
  const session = await auth()

  if (!session?.user?.id) {
    redirect(`/profile?callbackUrl=${encodeURIComponent(`/venue/dashboard/${venueId}`)}`)
  }

  await claimVenueMembershipForUser(session.user)

  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { id: true, ownerId: true },
  })

  if (!venue) {
    notFound()
  }

  const isOwnerOrAdmin = canEditVenue(session.user, venue)
  if (!isOwnerOrAdmin) {
    const memberResponse = await requireVenueMember(venueId, session.user)
    if (memberResponse) {
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
                You don&apos;t have permission to access this venue.
              </p>
              <Button asChild className="mt-4">
                <Link href="/venue/dashboard">Back to dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )
    }
  }

  const venueRole = await getVenueRole(venueId, session.user)

  return (
    <VenueRoleProvider venueRole={venueRole}>
      {children}
    </VenueRoleProvider>
  )
}
