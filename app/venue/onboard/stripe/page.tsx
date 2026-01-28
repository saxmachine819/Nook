import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { StripeConnectClient } from "./StripeConnectClient"

export default async function StripeConnectPage({
  searchParams,
}: {
  searchParams: { venueId?: string }
}) {
  const session = await auth()

  // Require authentication
  if (!session?.user?.id) {
    redirect("/profile?callbackUrl=/venue/onboard/stripe")
  }

  const venueId = searchParams.venueId

  if (!venueId) {
    redirect("/venue/onboard")
  }

  // Validate venue exists and belongs to user
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { id: true, name: true, ownerId: true, onboardingStatus: true },
  })

  if (!venue) {
    redirect("/venue/onboard?error=venue_not_found")
  }

  if (venue.ownerId !== session.user.id) {
    redirect("/venue/onboard?error=unauthorized")
  }

  // User is authenticated and venue is valid, render the client component
  return <StripeConnectClient venueId={venueId} />
}
