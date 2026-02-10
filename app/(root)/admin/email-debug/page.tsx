import React from "react"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/venue-auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { EmailDebugClient } from "./EmailDebugClient"

const VALID_STATUSES = ["PENDING", "SENT", "FAILED"] as const
const EMAIL_TYPE_SUBJECTS: Record<string, string> = {
  welcome: "Welcome to Nooc",
  welcome_user: "Welcome to Nooc",
  booking_confirmation: "Booking confirmed",
  booking_canceled: "Booking canceled",
  venue_booking_created: "New booking at your venue",
  venue_booking_canceled: "Booking canceled at your venue",
  booking_end_5min: "Your booking ends in 5 minutes",
  venue_approved: "Venue approved",
  customer_follow_up: "Thanks for using Nooc today ☕",
}

async function getNotificationEvents(status?: string, type?: string) {
  try {
    const where: { status?: (typeof VALID_STATUSES)[number]; type?: string } = {}
    if (status && VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      where.status = status as (typeof VALID_STATUSES)[number]
    }
    if (type && type.trim()) {
      where.type = type.trim()
    }

    const events = await prisma.notificationEvent.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        type: true,
        status: true,
        toEmail: true,
        userId: true,
        venueId: true,
        bookingId: true,
        payload: true,
        error: true,
        sentAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    })

    return events.map((e) => {
      const payload = e.payload as { venueName?: string } | null
      const subject =
        e.type === "venue_approved" && payload?.venueName
          ? `${payload.venueName} is approved — you're live on Nooc 🎉`
          : EMAIL_TYPE_SUBJECTS[e.type] ?? e.type
      return {
        id: e.id,
        createdAt: e.createdAt.toISOString(),
        type: e.type,
        status: e.status,
        toEmail: e.toEmail,
        userId: e.userId,
        venueId: e.venueId,
        bookingId: e.bookingId,
        payload: e.payload,
        error: e.error,
        sentAt: e.sentAt?.toISOString() ?? null,
        subject,
      }
    })
  } catch (error) {
    console.error("Error fetching notification events:", error)
    return []
  }
}

export default async function AdminEmailDebugPage({
  searchParams,
}: {
  searchParams: { status?: string; type?: string }
}) {
  const session = await auth()

  if (!session?.user || !isAdmin(session.user)) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Not authorized</CardTitle>
              <CardDescription>
                You do not have permission to access this page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/">Go to Home</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const statusFilter = searchParams?.status ?? ""
  const typeFilter = searchParams?.type ?? ""
  const events = await getNotificationEvents(statusFilter || undefined, typeFilter || undefined)

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Email Debug</h1>
            <p className="text-sm text-muted-foreground">
              View recent notification events (read-only)
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin">Back to Admin</Link>
          </Button>
        </div>
      </div>

      <EmailDebugClient
        events={events}
        initialStatusFilter={statusFilter}
        initialTypeFilter={typeFilter}
      />
    </div>
  )
}
