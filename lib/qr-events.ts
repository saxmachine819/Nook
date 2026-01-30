import { prisma } from "@/lib/prisma"

export interface RecordQRScanEventPayload {
  token: string
  qrAssetId?: string | null
  eventType: "scan"
  venueId?: string | null
  resourceType?: string | null
  resourceId?: string | null
  userId?: string | null
  sessionId?: string | null
  userAgent?: string | null
}

/**
 * Records a QR scan event in qr_events. Call once per /q/[token] page load.
 * Failures are logged and not rethrown so the page never breaks due to event write errors.
 */
export async function recordQRScanEvent(payload: RecordQRScanEventPayload): Promise<void> {
  try {
    await prisma.qREvent.create({
      data: {
        token: payload.token,
        qrAssetId: payload.qrAssetId ?? undefined,
        eventType: payload.eventType,
        venueId: payload.venueId ?? undefined,
        resourceType: payload.resourceType ?? undefined,
        resourceId: payload.resourceId ?? undefined,
        userId: payload.userId ?? undefined,
        sessionId: payload.sessionId ?? undefined,
        userAgent: payload.userAgent ?? undefined,
      },
    })
  } catch (error) {
    console.error("Failed to record QR scan event", error)
  }
}
