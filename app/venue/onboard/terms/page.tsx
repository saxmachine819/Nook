import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { VenueTermsClient } from "./VenueTermsClient"

export default async function VenueTermsPage({
  searchParams,
}: {
  searchParams: { venueId?: string }
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/profile?callbackUrl=/venue/onboard/terms")
  }

  const venueId = searchParams.venueId

  if (!venueId) {
    redirect("/venue/onboard")
  }

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

  if (venue.onboardingStatus !== "DRAFT") {
    redirect("/venue/onboard?error=invalid_status")
  }

  return <VenueTermsClient venueId={venueId} venueName={venue.name} />
}
