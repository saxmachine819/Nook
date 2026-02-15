import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { persistVenuePhotos } from "@/lib/persist-venue-photos"
import { canEditVenue } from "@/lib/venue-auth"
import { parseGooglePeriodsToVenueHoursWithTimezone, syncVenueHoursFromGoogle } from "@/lib/venue-hours"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const venueId = params.id

    // Require authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to edit a venue." },
        { status: 401 }
      )
    }

    // Fetch venue to check authorization
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, ownerId: true },
    })

    if (!venue) {
      return NextResponse.json(
        { error: "Venue not found." },
        { status: 404 }
      )
    }

    // Check authorization
    if (!canEditVenue(session.user, venue)) {
      return NextResponse.json(
        { error: "You don't have permission to edit this venue." },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Validate required fields (name is not required for updates - it's locked after creation)
    if (!body.address) {
      return NextResponse.json(
        { error: "Missing required fields: address is required" },
        { status: 400 }
      )
    }

    if (body.ownerPhone !== undefined && (typeof body.ownerPhone !== "string" || !body.ownerPhone.trim())) {
      return NextResponse.json(
        { error: "Owner phone number is required" },
        { status: 400 }
      )
    }

    // Validate tables if provided
    if (body.tables) {
      if (!Array.isArray(body.tables) || body.tables.length === 0) {
        return NextResponse.json(
          { error: "At least one table is required" },
          { status: 400 }
        )
      }

      for (const table of body.tables) {
        const bookingMode = table.bookingMode || "individual"
        if (bookingMode !== "group" && bookingMode !== "individual") {
          return NextResponse.json(
            { error: "bookingMode must be 'group' or 'individual'" },
            { status: 400 }
          )
        }

        if (bookingMode === "group") {
          if (typeof table.tablePricePerHour !== "number" || table.tablePricePerHour <= 0) {
            return NextResponse.json(
              { error: "Group booking mode requires tablePricePerHour greater than 0" },
              { status: 400 }
            )
          }
        }

        if (bookingMode === "individual") {
          if (!table.seats || !Array.isArray(table.seats) || table.seats.length === 0) {
            return NextResponse.json(
              { error: "Individual booking mode requires at least one seat" },
              { status: 400 }
            )
          }
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
    }

    // Parse numeric fields
    const parsedLatitude = body.latitude
      ? (typeof body.latitude === "string" ? parseFloat(body.latitude) : body.latitude)
      : null
    const parsedLongitude = body.longitude
      ? (typeof body.longitude === "string" ? parseFloat(body.longitude) : body.longitude)
      : null

    const persisted = await persistVenuePhotos({
      venueId,
      imageUrls: body.imageUrls,
      heroImageUrl: body.heroImageUrl,
    })

    // Update venue and tables/seats in a transaction
    const updatedVenue = await prisma.$transaction(async (tx) => {
      // Update venue fields (name is locked after creation, so don't update it)
      // Single venue hours pathway: manual edit → hoursSource=manual; "Use Google hours" → hoursSource=google
      const hoursSourceUpdate =
        body.venueHours != null
          ? { hoursSource: body.hoursSource ?? "manual" as string, hoursUpdatedAt: new Date() }
          : {}

      await tx.venue.update({
        where: { id: venueId },
        data: {
          // name: body.name.trim(), // Name cannot be changed after creation
          address: body.address.trim(),
          neighborhood: body.neighborhood?.trim() || null,
          city: body.city?.trim() || null,
          state: body.state?.trim() || null,
          zipCode: body.zipCode?.trim() || null,
          latitude: parsedLatitude && !isNaN(parsedLatitude) ? parsedLatitude : null,
          longitude: parsedLongitude && !isNaN(parsedLongitude) ? parsedLongitude : null,
          rulesText: body.rulesText?.trim() || null,
          tags: Array.isArray(body.tags) ? body.tags : [],
          description: body.description?.trim() || null,
          ...(body.ownerFirstName !== undefined && { ownerFirstName: body.ownerFirstName?.trim() || null }),
          ...(body.ownerLastName !== undefined && { ownerLastName: body.ownerLastName?.trim() || null }),
          ...(body.ownerPhone !== undefined && { ownerPhone: body.ownerPhone.trim() }),
          googlePlaceId: body.googlePlaceId?.trim() || null,
          googleMapsUrl: body.googleMapsUrl?.trim() || null,
          openingHoursJson: body.openingHoursJson ?? undefined,
          googlePhotoRefs: body.googlePhotoRefs || null,
          placePhotoUrls: Array.isArray(body.placePhotoUrls) ? body.placePhotoUrls : undefined,
          heroImageUrl: persisted.heroImageUrl,
          ...hoursSourceUpdate,
          imageUrls: persisted.imageUrls.length > 0 ? persisted.imageUrls : Prisma.JsonNull,
        },
      })

      // Update venue hours if provided (single pathway: manual → source=manual, Use Google → source=google)
      const hourSource = body.hoursSource === "google" ? "google" : "manual"
      if (body.venueHours && Array.isArray(body.venueHours)) {
        for (const hourData of body.venueHours) {
          await tx.venueHours.upsert({
            where: {
              venueId_dayOfWeek: {
                venueId: venueId,
                dayOfWeek: hourData.dayOfWeek,
              },
            },
            update: {
              isClosed: hourData.isClosed,
              openTime: hourData.openTime || null,
              closeTime: hourData.closeTime || null,
              source: hourSource,
            },
            create: {
              venueId: venueId,
              dayOfWeek: hourData.dayOfWeek,
              isClosed: hourData.isClosed,
              openTime: hourData.openTime || null,
              closeTime: hourData.closeTime || null,
              source: hourSource,
            },
          })
        }
      }

      // If tables are provided, update tables and seats
      if (body.tables && Array.isArray(body.tables)) {
        // Delete all existing tables (cascade will delete seats and reservations)
        await tx.table.deleteMany({
          where: { venueId: venueId },
        })

        // Create new tables and seats
        for (const table of body.tables) {
          const bookingMode = table.bookingMode || "individual"
          const tablePricePerHour = bookingMode === "group" ? Number(table.tablePricePerHour) : null

          await tx.table.create({
            data: {
              venueId: venueId,
              name: table.name.trim(),
              seatCount: table.seats?.length || 0,
              bookingMode,
              tablePricePerHour,
              imageUrls: table.imageUrls && Array.isArray(table.imageUrls) && table.imageUrls.length > 0
                ? table.imageUrls
                : null,
              directionsText: table.directionsText?.trim() || null,
              seats: {
                create: (table.seats || []).map((seat: any, index: number) => ({
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
            },
          })
        }
      }

      // "Use Google hours" pathway: sync from openingHoursJson and set hoursSource=google
      if (!body.venueHours && body.openingHoursJson !== undefined) {
        try {
          const openingHours = body.openingHoursJson as any
          if (openingHours && openingHours.periods && Array.isArray(openingHours.periods) && openingHours.periods.length > 0) {
            const current = await tx.venue.findUnique({
              where: { id: venueId },
              select: { hoursSource: true, timezone: true },
            })
            const timezone = current?.timezone || "America/New_York"
            const hoursData = parseGooglePeriodsToVenueHoursWithTimezone(openingHours.periods, venueId, timezone, "google")
            await syncVenueHoursFromGoogle(tx, venueId, hoursData, current?.hoursSource ?? null)
            if (body.hoursSource === "google") {
              await tx.venue.update({
                where: { id: venueId },
                data: { hoursSource: "google", hoursUpdatedAt: new Date() },
              })
            }
          } else if (body.openingHoursJson === null) {
            await tx.venueHours.deleteMany({
              where: { venueId },
            })
          }
        } catch (error) {
          console.error("Error parsing venue hours:", error)
        }
      }

      // Return updated venue with tables
      return await tx.venue.findUnique({
        where: { id: venueId },
        include: {
          tables: {
            include: {
              seats: true,
            },
          },
        },
      })
    })

    return NextResponse.json({ venue: updatedVenue })
  } catch (error: any) {
    console.error("Error updating venue:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to update venue. Please try again." },
      { status: 500 }
    )
  }
}
