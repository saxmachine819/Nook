import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

export interface EnqueueNotificationInput {
  type: string
  dedupeKey: string
  toEmail: string
  userId?: string | null
  venueId?: string | null
  bookingId?: string | null
  payload: Prisma.InputJsonValue
}

export interface EnqueueNotificationResult {
  created: boolean
  id: string
}

/**
 * Enqueue a notification event. Idempotent by dedupeKey:
 * if an event with the same dedupeKey already exists, returns it without creating a new row.
 */
export async function enqueueNotification(
  input: EnqueueNotificationInput
): Promise<EnqueueNotificationResult> {
  const existing = await prisma.notificationEvent.findUnique({
    where: { dedupeKey: input.dedupeKey },
    select: { id: true },
  })

  if (existing) {
    return { created: false, id: existing.id }
  }

  const created = await prisma.notificationEvent.create({
    data: {
      type: input.type,
      dedupeKey: input.dedupeKey,
      toEmail: input.toEmail,
      userId: input.userId ?? undefined,
      venueId: input.venueId ?? undefined,
      bookingId: input.bookingId ?? undefined,
      payload: input.payload,
      status: "PENDING",
    },
    select: { id: true },
  })

  return { created: true, id: created.id }
}
