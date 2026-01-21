import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.name || !body.address || !body.hourlySeatPrice) {
      return NextResponse.json(
        { error: "Missing required fields: name, address, and hourlySeatPrice are required" },
        { status: 400 }
      )
    }

    // Validate tables
    if (!body.tables || !Array.isArray(body.tables) || body.tables.length === 0) {
      return NextResponse.json(
        { error: "At least one table with name and seatCount is required" },
        { status: 400 }
      )
    }

    // Validate each table
    for (const table of body.tables) {
      if (!table.name || typeof table.seatCount !== "number" || table.seatCount < 1) {
        return NextResponse.json(
          { error: "Each table must have a name and seatCount (minimum 1)" },
          { status: 400 }
        )
      }
    }

    // Parse and validate numeric fields
    const parsedHourlyPrice = parseFloat(body.hourlySeatPrice)
    if (isNaN(parsedHourlyPrice) || parsedHourlyPrice <= 0) {
      return NextResponse.json(
        { error: "hourlySeatPrice must be a valid number greater than 0" },
        { status: 400 }
      )
    }

    const parsedLatitude = body.latitude 
      ? (typeof body.latitude === 'string' ? parseFloat(body.latitude) : body.latitude)
      : null
    const parsedLongitude = body.longitude
      ? (typeof body.longitude === 'string' ? parseFloat(body.longitude) : body.longitude)
      : null

    // Create venue with tables in a transaction
    const venue = await prisma.venue.create({
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
        // Google Places enrichment fields
        googlePlaceId: body.googlePlaceId?.trim() || null,
        googleMapsUrl: body.googleMapsUrl?.trim() || null,
        openingHoursJson: body.openingHoursJson || null,
        googlePhotoRefs: body.googlePhotoRefs || null,
        heroImageUrl: body.heroImageUrl?.trim() || null,
        imageUrls: body.imageUrls || null,
        tables: {
          create: body.tables.map((table: { name: string; seatCount: number }) => ({
            name: table.name.trim(),
            seatCount: Number(table.seatCount),
          })),
        },
      },
      include: {
        tables: true,
      },
    })

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