import React from "react"
import { Resend } from "resend"
import { prisma } from "@/lib/prisma"
import { validateEmailEnv, getFromAddress } from "@/lib/email-send"
import WelcomeEmail from "@/emails/WelcomeEmail"
import BookingConfirmationEmail from "@/emails/BookingConfirmationEmail"
import BookingCanceledEmail from "@/emails/BookingCanceledEmail"
import VenueBookingCreatedEmail from "@/emails/VenueBookingCreatedEmail"
import VenueBookingCanceledEmail from "@/emails/VenueBookingCanceledEmail"
import BookingEndReminderEmail from "@/emails/BookingEndReminderEmail"
import BookingReminder60MinEmail from "@/emails/BookingReminder60MinEmail"

const BATCH_SIZE = 25
const MAX_ERROR_LENGTH = 1000

type Payload = Record<string, unknown>

interface Handler {
  subject: string
  render: (payload: Payload) => React.ReactElement
}

const REGISTRY: Record<string, Handler> = {
  welcome: {
    subject: "Welcome to Nooc",
    render: (p) => React.createElement(WelcomeEmail, { userName: p.userName as string | undefined, ctaUrl: p.ctaUrl as string | undefined }),
  },
  welcome_user: {
    subject: "Welcome to Nooc",
    render: (p) => React.createElement(WelcomeEmail, { userName: p.userName as string | undefined, ctaUrl: p.ctaUrl as string | undefined }),
  },
  booking_confirmation: {
    subject: "Booking confirmed",
    render: (p) =>
      React.createElement(BookingConfirmationEmail, {
        venueName: p.venueName as string | undefined,
        startAt: p.startAt as string | undefined,
        endAt: p.endAt as string | undefined,
        confirmationUrl: p.confirmationUrl as string | undefined,
        timeZone: p.timeZone as string | undefined,
      }),
  },
  booking_canceled: {
    subject: "Booking canceled",
    render: (p) =>
      React.createElement(BookingCanceledEmail, {
        venueName: p.venueName as string | undefined,
        startAt: p.startAt as string | undefined,
        canceledAt: p.canceledAt as string | undefined,
        timeZone: p.timeZone as string | undefined,
      }),
  },
  venue_booking_created: {
    subject: "New booking at your venue",
    render: (p) =>
      React.createElement(VenueBookingCreatedEmail, {
        venueName: p.venueName as string | undefined,
        guestEmail: p.guestEmail as string | undefined,
        startAt: p.startAt as string | undefined,
        endAt: p.endAt as string | undefined,
        timeZone: p.timeZone as string | undefined,
      }),
  },
  venue_booking_canceled: {
    subject: "Booking canceled at your venue",
    render: (p) =>
      React.createElement(VenueBookingCanceledEmail, {
        venueName: p.venueName as string | undefined,
        guestEmail: p.guestEmail as string | undefined,
        startAt: p.startAt as string | undefined,
        canceledAt: p.canceledAt as string | undefined,
        timeZone: p.timeZone as string | undefined,
      }),
  },
  booking_end_5min: {
    subject: "Your booking ends in 5 minutes",
    render: (p) =>
      React.createElement(BookingEndReminderEmail, {
        venueName: p.venueName as string | undefined,
        endAt: p.suggestedExtensionStartAt as string | undefined,
        extendUrl: p.extendUrl as string | undefined,
        nextSlotAvailable: p.nextSlotAvailable as boolean | undefined,
        timeZone: p.timeZone as string | undefined,
      }),
  },
  booking_reminder_60min: {
    subject: "Your Nooc booking starts in 1 hour",
    render: (p) =>
      React.createElement(BookingReminder60MinEmail, {
        venueName: p.venueName as string | undefined,
        startAt: p.startAt as string | undefined,
        endAt: p.endAt as string | undefined,
        seatLabel: p.seatLabel as string | null | undefined,
        tableLabel: p.tableLabel as string | undefined,
        viewBookingUrl: p.viewBookingUrl as string | undefined,
        timeZone: p.timeZone as string | undefined,
      }),
  },
}

export interface DispatchResult {
  processed: number
  sent: number
  failed: number
  envError?: string
}

function truncateError(msg: string): string {
  if (msg.length <= MAX_ERROR_LENGTH) return msg
  return msg.slice(0, MAX_ERROR_LENGTH - 3) + "..."
}

export async function runDispatcher(): Promise<DispatchResult> {
  const envResult = validateEmailEnv()
  if (!envResult.ok) {
    return { processed: 0, sent: 0, failed: 0, envError: envResult.message }
  }

  const from = getFromAddress()
  const resend = new Resend(process.env.RESEND_API_KEY!)

  const events = await prisma.notificationEvent.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  })

  let sent = 0
  let failed = 0

  for (const event of events) {
    const handler = REGISTRY[event.type]
    if (!handler) {
      await prisma.notificationEvent.update({
        where: { id: event.id },
        data: { status: "FAILED", error: truncateError("Unknown event type") },
      })
      failed++
      continue
    }

    const payload = (event.payload as Payload) ?? {}
    let errorMessage: string | null = null

    try {
      const { data, error } = await resend.emails.send({
        from,
        to: [event.toEmail],
        subject: handler.subject,
        react: handler.render(payload),
      })
      if (error) errorMessage = error.message ?? "Failed to send"
      else if (!data?.id) errorMessage = "Failed to send"
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "Failed to send"
    }

    if (errorMessage) {
      await prisma.notificationEvent.update({
        where: { id: event.id },
        data: { status: "FAILED", error: truncateError(errorMessage) },
      })
      failed++
    } else {
      await prisma.notificationEvent.update({
        where: { id: event.id },
        data: { status: "SENT", sentAt: new Date(), error: null },
      })
      sent++
    }
  }

  return { processed: events.length, sent, failed }
}
