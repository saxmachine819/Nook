import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { enqueueNotification } from "@/lib/notification-queue"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Require authentication
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to submit a venue." },
        { status: 401 }
      )
    }

    const venueId = params.id

    // Find the venue and verify ownership
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, ownerId: true, onboardingStatus: true },
    })

    if (!venue) {
      return NextResponse.json(
        { error: "Venue not found." },
        { status: 404 }
      )
    }

    if (venue.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: "You do not have permission to submit this venue." },
        { status: 403 }
      )
    }

    // Only allow submission from "DRAFT" status
    if (venue.onboardingStatus !== "DRAFT") {
      return NextResponse.json(
        { error: `Venue cannot be submitted. Current status: ${venue.onboardingStatus}` },
        { status: 400 }
      )
    }

    // Update venue status to "SUBMITTED" and set submittedAt
    const updatedVenue = await prisma.venue.update({
      where: { id: venueId },
      data: {
        onboardingStatus: "SUBMITTED",
        submittedAt: new Date(),
      },
      select: { id: true, name: true, onboardingStatus: true },
    })

    // Notify each site admin (ADMIN_EMAILS) with a link to the approvals page
    const adminEmailsRaw = process.env.ADMIN_EMAILS
    if (adminEmailsRaw?.trim()) {
      const adminEmails = adminEmailsRaw
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? ""
      const approvalsUrl = baseUrl ? `${baseUrl}/admin/approvals` : ""
      for (const adminEmail of adminEmails) {
        try {
          await enqueueNotification({
            type: "admin_venue_submission",
            dedupeKey: `admin_venue_submission:${venueId}:${adminEmail}`,
            toEmail: adminEmail,
            venueId,
            payload: {
              venueName: updatedVenue.name,
              approvalsUrl,
            },
          })
        } catch (err) {
          console.error("Failed to enqueue admin_venue_submission for", adminEmail, err)
        }
      }
    }

    return NextResponse.json({ venue: updatedVenue }, { status: 200 })
  } catch (error: any) {
    console.error("Error submitting venue:", error)
    
    const errorMessage = error?.message || "Failed to submit venue. Please try again."
    
    return NextResponse.json(
      { error: errorMessage, details: process.env.NODE_ENV === "development" ? error?.message : undefined },
      { status: 500 }
    )
  }
}
