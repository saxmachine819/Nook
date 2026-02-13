import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { persistVenuePhotos } from "@/lib/persist-venue-photos"
import { parseGooglePeriodsToVenueHours, syncVenueHoursFromGoogle } from "@/lib/venue-hours"

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to create a venue." },
        { status: 401 }
      )
    }

    const body = await request.json()

    // Validate required fields
    // Allow onboardingStatus field (defaults to "DRAFT" for new venues)
    const onboardingStatus = body.onboardingStatus || "DRAFT"
    
    // For draft status, relax hourlySeatPrice requirement (it's deprecated anyway)
    if (!body.name || !body.address) {
      return NextResponse.json(
        { error: "Missing required fields: name and address are required" },
        { status: 400 }
      )
    }

    if (!body.ownerPhone || typeof body.ownerPhone !== "string" || !body.ownerPhone.trim()) {
      return NextResponse.json(
        { error: "Owner phone number is required" },
        { status: 400 }
      )
    }

    // For non-draft venues, still validate hourlySeatPrice for backward compatibility
    if (onboardingStatus !== "DRAFT" && (!body.hourlySeatPrice || parseFloat(body.hourlySeatPrice) <= 0)) {
      return NextResponse.json(
        { error: "hourlySeatPrice is required for non-draft venues" },
        { status: 400 }
      )
    }

    // Validate tables
    if (!body.tables || !Array.isArray(body.tables) || body.tables.length === 0) {
      return NextResponse.json(
        { error: "At least one table with name and seats is required" },
        { status: 400 }
      )
    }

    // Validate each table and its seats
    for (const table of body.tables) {
      if (!table.name || !table.seats || !Array.isArray(table.seats) || table.seats.length === 0) {
        return NextResponse.json(
          { error: "Each table must have a name and at least one seat" },
          { status: 400 }
        )
      }

      // Validate booking mode
      const bookingMode = table.bookingMode || "individual"
      if (bookingMode !== "group" && bookingMode !== "individual") {
        return NextResponse.json(
          { error: "bookingMode must be 'group' or 'individual'" },
          { status: 400 }
        )
      }

      // Validate group mode requires tablePricePerHour
      if (bookingMode === "group") {
        if (typeof table.tablePricePerHour !== "number" || table.tablePricePerHour <= 0) {
          return NextResponse.json(
            { error: "Group booking mode requires tablePricePerHour greater than 0" },
            { status: 400 }
          )
        }
      }

      // Validate individual mode: each seat has pricePerHour
      if (bookingMode === "individual") {
        for (const seat of table.seats) {
          if (typeof seat.pricePerHour !== "number" || seat.pricePerHour <= 0) {
            return NextResponse.json(
              { error: "Each seat must have a valid pricePerHour greater than 0" },
              { status: 400 }
            )
          }
        }
      }
    }

    // Parse and validate numeric fields
    // For draft venues, use 0 as default hourlySeatPrice (deprecated field)
    const parsedHourlyPrice = body.hourlySeatPrice 
      ? parseFloat(body.hourlySeatPrice)
      : 0
    if (isNaN(parsedHourlyPrice) || (onboardingStatus !== "DRAFT" && parsedHourlyPrice <= 0)) {
      return NextResponse.json(
        { error: "hourlySeatPrice must be a valid number greater than 0 for non-draft venues" },
        { status: 400 }
      )
    }

    const parsedLatitude = body.latitude 
      ? (typeof body.latitude === 'string' ? parseFloat(body.latitude) : body.latitude)
      : null
    const parsedLongitude = body.longitude
      ? (typeof body.longitude === 'string' ? parseFloat(body.longitude) : body.longitude)
      : null

    // Create venue, persist Google photos to Supabase, then update venue with persisted URLs (all in one transaction)
    const venue = await prisma.$transaction(async (tx) => {
      const created = await tx.venue.create({
        data: {
          name: body.name.trim(),
          address: body.address.trim(),
          neighborhood: body.neighborhood?.trim() || null,
          city: body.city?.trim() || null,
          state: body.state?.trim() || null,
          zipCode: body.zipCode?.trim() || null,
          latitude: parsedLatitude && !isNaN(parsedLatitude) ? parsedLatitude : null,
          longitude: parsedLongitude && !isNaN(parsedLongitude) ? parsedLongitude : null,
          hourlySeatPrice: parsedHourlyPrice,
          rulesText: body.rulesText?.trim() || null,
          tags: Array.isArray(body.tags) ? body.tags : [],
          description: body.description?.trim() || null,
          onboardingStatus: onboardingStatus,
          ownerId: session.user.id,
          ownerFirstName: body.ownerFirstName?.trim() || null,
          ownerLastName: body.ownerLastName?.trim() || null,
          ownerPhone: body.ownerPhone.trim(),
          googlePlaceId: body.googlePlaceId?.trim() || null,
          googleMapsUrl: body.googleMapsUrl?.trim() || null,
          openingHoursJson: body.openingHoursJson || null,
          googlePhotoRefs: body.googlePhotoRefs || null,
          heroImageUrl: body.heroImageUrl?.trim() || null,
          imageUrls: body.imageUrls || null,
          tables: {
            create: body.tables.map((table: any) => {
              const bookingMode = table.bookingMode || "individual"
              const tablePricePerHour = bookingMode === "group" ? Number(table.tablePricePerHour) : null

              return {
                name: table.name.trim(),
                seatCount: table.seats.length,
                bookingMode,
                tablePricePerHour,
                imageUrls: table.imageUrls && Array.isArray(table.imageUrls) && table.imageUrls.length > 0
                  ? table.imageUrls
                  : null,
                directionsText: table.directionsText?.trim() || null,
                seats: {
                  create: table.seats.map((seat: any, index: number) => ({
                    pricePerHour: Number(seat.pricePerHour),
                    position: seat.position ?? index + 1,
                    label: seat.label?.trim() || null,
                    tags: seat.tags && Array.isArray(seat.tags) && seat.tags.length > 0
                      ? seat.tags
                      : null,
                    imageUrls: seat.imageUrls && Array.isArray(seat.imageUrls) && seat.imageUrls.length > 0
                      ? seat.imageUrls
                      : null,
                  })),
                },
              }
            }),
          },
        },
        include: {
          tables: {
            include: {
              seats: true,
            },
          },
        },
      })

      const persisted = await persistVenuePhotos({
        venueId: created.id,
        imageUrls: body.imageUrls,
        heroImageUrl: body.heroImageUrl,
      })

      await tx.venue.update({
        where: { id: created.id },
        data: {
          imageUrls: persisted.imageUrls.length > 0 ? persisted.imageUrls : null,
          heroImageUrl: persisted.heroImageUrl,
        },
      })

      const updated = await tx.venue.findUnique({
        where: { id: created.id },
        include: {
          tables: {
            include: {
              seats: true,
            },
          },
        },
      })
      if (!updated) throw new Error("Venue not found after create")
      return updated
    })

    // Parse and save venue hours if openingHoursJson exists (new venue: hoursSource is null)
    if (body.openingHoursJson) {
      try {
        const openingHours = body.openingHoursJson as any
        if (openingHours.periods && Array.isArray(openingHours.periods) && openingHours.periods.length > 0) {
          const hoursData = parseGooglePeriodsToVenueHours(openingHours.periods, venue.id, "google")
          await syncVenueHoursFromGoogle(prisma, venue.id, hoursData, null)
        }
      } catch (error) {
        // Log error but don't fail venue creation
        console.error("Error parsing venue hours:", error)
      }
    }

    return NextResponse.json({ venue }, { status: 201 })
  } catch (error: any) {
    console.error("Error creating venue:", error)
    
    // Return more specific error message
    const errorMessage = error?.message || "Failed to create venue. Please try again."
    
    // Check for Prisma errors
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "A venue with this information already exists." },
        { status: 409 }
      )
    }
    
    return NextResponse.json(
      { error: errorMessage, details: process.env.NODE_ENV === "development" ? error?.message : undefined },
      { status: 500 }
    )
  }
}