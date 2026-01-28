import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CompleteSubmissionClient } from "./CompleteSubmissionClient"

export default async function CompleteSubmissionPage({
  searchParams,
}: {
  searchParams: { venueId?: string }
}) {
  const session = await auth()

  // Require authentication
  if (!session?.user?.id) {
    redirect("/profile?callbackUrl=/venue/onboard/complete")
  }

  const venueId = searchParams.venueId

  if (!venueId) {
    redirect("/venue/onboard")
  }

  // Validate venue exists, belongs to user, and is in draft status
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      state: true,
      ownerId: true,
      onboardingStatus: true,
    },
  })

  if (!venue) {
    redirect("/venue/onboard?error=venue_not_found")
  }

  if (venue.ownerId !== session.user.id) {
    redirect("/venue/onboard?error=unauthorized")
  }

  if (venue.onboardingStatus !== "DRAFT") {
    redirect("/venue/onboard?error=invalid_status")
  }

  // User is authenticated and venue is valid, render the client component
  return <CompleteSubmissionClient venueId={venueId} venueName={venue.name} />
}
