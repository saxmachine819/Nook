import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CompleteSubmissionClient } from "./CompleteSubmissionClient"

export type VenueSummary = {
  venueInfo: { name: string; addressLine: string }
  photosAndRules: { photoCount: number; rulesSummary: string; tagsCount: number }
  tablesAndSeats: { tableCount: number; totalSeats: number }
  qr: { qrAssetCount: number }
}

function buildVenueSummary(venue: {
  name: string
  address: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  heroImageUrl: string | null
  imageUrls: unknown
  rulesText: string | null
  tags: string[]
  tables: Array<{ bookingMode: string; seatCount: number; _count: { seats: number } }>
  _count: { qrAssets: number }
}): VenueSummary {
  const parts = [venue.address, venue.city, venue.state, venue.zipCode].filter(Boolean)
  const addressLine = parts.length > 0 ? parts.join(", ") : "Address not set"

  let photoCount = 0
  if (venue.heroImageUrl) photoCount += 1
  if (venue.imageUrls != null) {
    const urls = Array.isArray(venue.imageUrls)
      ? venue.imageUrls
      : typeof venue.imageUrls === "string"
        ? (JSON.parse(venue.imageUrls) as string[])
        : []
    photoCount += urls.length
  }

  const rulesSummary = venue.rulesText?.trim() ? "Rules set" : "No rules"
  const tagsCount = venue.tags?.length ?? 0

  let totalSeats = 0
  for (const t of venue.tables) {
    if (t.bookingMode === "group") {
      totalSeats += t.seatCount
    } else {
      totalSeats += t._count.seats
    }
  }
  const tableCount = venue.tables.length

  return {
    venueInfo: { name: venue.name, addressLine },
    photosAndRules: { photoCount, rulesSummary, tagsCount },
    tablesAndSeats: { tableCount, totalSeats },
    qr: { qrAssetCount: venue._count.qrAssets },
  }
}

export default async function CompleteSubmissionPage({
  searchParams,
}: {
  searchParams: { venueId?: string }
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/profile?callbackUrl=/venue/onboard/complete")
  }

  const venueId = searchParams.venueId
  if (!venueId) {
    redirect("/venue/onboard")
  }

  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      state: true,
      zipCode: true,
      ownerId: true,
      onboardingStatus: true,
      venueTermsAcceptedAt: true,
      heroImageUrl: true,
      imageUrls: true,
      rulesText: true,
      tags: true,
      tables: {
        select: {
          id: true,
          bookingMode: true,
          seatCount: true,
          _count: { select: { seats: true } },
        },
      },
      _count: { select: { qrAssets: true } },
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

  if (venue.venueTermsAcceptedAt == null) {
    redirect(`/venue/onboard/terms?venueId=${venueId}`)
  }

  const venueSummary = buildVenueSummary(venue)

  return (
    <CompleteSubmissionClient
      venueId={venueId}
      venueName={venue.name}
      venueSummary={venueSummary}
    />
  )
}
