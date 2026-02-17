import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { VenueOnboardClient } from "./VenueOnboardClient"

export default async function VenueOnboardPage() {
  const session = await auth()

  // Require authentication - redirect to sign-in if not authenticated
  if (!session?.user?.id) {
    redirect("/profile?callbackUrl=/venue/onboard")
  }

  // User is authenticated, render the client component
  return <VenueOnboardClient initialOwnerName={session.user.name ?? undefined} />
}
