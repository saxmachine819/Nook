import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditVenue } from "@/lib/venue-auth"
import { persistPlacePhotoUrls } from "@/lib/persist-venue-photos"

export const dynamic = "force-dynamic"

/**
 * POST /api/venues/[id]/persist-place-photos
 * Fetches place details for the venue's googlePlaceId, persists all place photos to Supabase,
 * updates venue.placePhotoUrls, and returns the Supabase URLs.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: venueId } = await context.params

    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 }
      )
    }

    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, ownerId: true, googlePlaceId: true },
    })

    if (!venue) {
      return NextResponse.json({ error: "Venue not found." }, { status: 404 })
    }

    if (!canEditVenue(session.user, venue)) {
      return NextResponse.json(
        { error: "You don't have permission to edit this venue." },
        { status: 403 }
      )
    }

    const placeId = venue.googlePlaceId
    if (!placeId) {
      return NextResponse.json(
        { error: "Venue has no Google place." },
        { status: 400 }
      )
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "Google Places API key not configured." },
        { status: 500 }
      )
    }

    const placeIdFormatted = placeId.startsWith("places/") ? placeId : `places/${placeId}`
    const fieldMask = "displayName,formattedAddress,location,regularOpeningHours,photos,googleMapsUri"
    const placeRes = await fetch(
      `https://places.googleapis.com/v1/${placeIdFormatted}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": fieldMask,
        },
      }
    )

    let googlePhotoUrls: string[] = []

    if (placeRes.ok) {
      const placeData = await placeRes.json()
      const photos = placeData.photos || []
      googlePhotoUrls = photos
        .map((p: { name?: string }) =>
          p.name
            ? `https://places.googleapis.com/v1/${p.name}/media?key=${apiKey}&maxHeightPx=800&maxWidthPx=800`
            : ""
        )
        .filter(Boolean)
    } else {
      console.warn("Persist place photos: direct Google call failed", placeRes.status, await placeRes.text())
    }

    // Fallback: if we got no photos (e.g. different API behavior), fetch via our place-details route which is known to return photos for this venue
    if (googlePhotoUrls.length === 0) {
      const base =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
        "http://localhost:3000"
      try {
        const fallbackRes = await fetch(
          `${base}/api/google/place-details?placeId=${encodeURIComponent(placeId)}`,
          { cache: "no-store" }
        )
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json()
          const fallbackPhotos = fallbackData.photos || []
          googlePhotoUrls = fallbackPhotos
            .map((p: { photoUrl?: string }) => p.photoUrl)
            .filter(Boolean)
        }
      } catch (e) {
        console.warn("Persist place photos: fallback place-details failed", e)
      }
    }

    if (googlePhotoUrls.length === 0) {
      await prisma.venue.update({
        where: { id: venueId },
        data: { placePhotoUrls: [] },
      })
      return NextResponse.json({ placePhotoUrls: [] })
    }

    const placePhotoUrls = await persistPlacePhotoUrls(venueId, googlePhotoUrls)

    await prisma.venue.update({
      where: { id: venueId },
      data: { placePhotoUrls },
    })

    return NextResponse.json({ placePhotoUrls })
  } catch (error: unknown) {
    console.error("persist-place-photos error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to persist place photos." },
      { status: 500 }
    )
  }
}
