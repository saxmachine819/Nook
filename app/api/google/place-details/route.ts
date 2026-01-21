import { NextResponse } from "next/server"

// Google Places API (New) endpoint
const PLACES_API_BASE = "https://places.googleapis.com/v1"

interface PlaceDetailsResponse {
  // Places API (New) uses displayName.text
  displayName?: { text?: string }
  formattedAddress?: string
  location?: {
    latitude: number
    longitude: number
  }
  regularOpeningHours?: {
    weekdayDescriptions?: string[]
    periods?: Array<{
      open: {
        day: number
        hour: number
        minute: number
      }
      close?: {
        day: number
        hour: number
        minute: number
      }
    }>
  }
  photos?: Array<{
    name: string
    widthPx: number
    heightPx: number
    authorAttributions?: Array<{
      displayName: string
      uri: string
      photoUri: string
    }>
  }>
  googleMapsUri?: string
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const placeId = searchParams.get("placeId")

    if (!placeId) {
      return NextResponse.json(
        { error: "placeId parameter is required" },
        { status: 400 }
      )
    }

    // Use server-side API key (or fallback to public key if configured for Places)
    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: "Google Places API key not configured" },
        { status: 500 }
      )
    }

    // Call Google Places API (New) Place Details endpoint
    // Using field mask to request only needed fields
    const fieldMask = [
      "displayName",
      "formattedAddress",
      "location",
      "regularOpeningHours",
      "photos",
      "googleMapsUri",
    ].join(",")

    // Google Places API (New) uses format: places/{place_id}
    // The place_id from Autocomplete is just the ID, so we need to format it
    const placeIdFormatted = placeId.startsWith("places/") ? placeId : `places/${placeId}`
    
    console.log("Fetching place details:", { placeId, placeIdFormatted, apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : "missing" })
    
    const response = await fetch(
      `${PLACES_API_BASE}/${placeIdFormatted}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": fieldMask,
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Google Places API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        placeIdFormatted,
      })
      
      // Return error with details for debugging
      return NextResponse.json(
        { 
          error: "Failed to fetch place details from Google Places API",
          details: errorText,
          status: response.status
        },
        { status: response.status }
      )
    }

    const data: PlaceDetailsResponse = await response.json()

    // Normalize and return data
    const normalized = {
      name: data.displayName?.text || null,
      formattedAddress: data.formattedAddress || null,
      location: data.location
        ? {
            latitude: data.location.latitude,
            longitude: data.location.longitude,
          }
        : null,
      openingHours: data.regularOpeningHours || null,
      photos: data.photos
        ? data.photos.map((photo) => {
            // Extract photo reference from name (format: places/{place_id}/photos/{photo_reference})
            const photoRef = photo.name.split("/").pop() || null
            return {
              name: photo.name,
              widthPx: photo.widthPx,
              heightPx: photo.heightPx,
              // Build photo URL using Places Photo API
              // Format: places/{place_id}/photos/{photo_reference}/media
              photoUrl: photoRef
                ? `https://places.googleapis.com/v1/${photo.name}/media?key=${apiKey}&maxHeightPx=800&maxWidthPx=800`
                : "",
              photoReference: photoRef,
            }
          })
        : [],
      googleMapsUri: data.googleMapsUri || null,
    }

    return NextResponse.json(normalized)
  } catch (error: any) {
    console.error("Error fetching place details:", error)
    return NextResponse.json(
      { error: "Failed to fetch place details", details: error.message },
      { status: 500 }
    )
  }
}
