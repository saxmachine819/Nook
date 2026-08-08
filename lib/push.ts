import { createSign } from "node:crypto"
import { prisma } from "@/lib/prisma"

export interface PushPayload {
  title: string
  body: string
  data?: Record<string, string>
}

const PUSH_COPY: Record<
  string,
  (payload: Record<string, unknown>) => PushPayload | null
> = {
  booking_confirmation: (p) => ({
    title: "Booking confirmed",
    body: p.venueName
      ? `You're booked at ${String(p.venueName)}`
      : "Your Nooc booking is confirmed",
    data: { type: "booking_confirmation", bookingId: String(p.bookingId ?? "") },
  }),
  booking_canceled: (p) => ({
    title: "Booking canceled",
    body: p.venueName
      ? `Your booking at ${String(p.venueName)} was canceled`
      : "Your Nooc booking was canceled",
    data: { type: "booking_canceled" },
  }),
  booking_reminder_60min: (p) => ({
    title: "Booking in 1 hour",
    body: p.venueName
      ? `Head to ${String(p.venueName)} — your seat is reserved`
      : "Your Nooc booking starts in 1 hour",
    data: { type: "booking_reminder_60min" },
  }),
  booking_end_5min: (p) => ({
    title: "Booking ending soon",
    body: p.venueName
      ? `Your time at ${String(p.venueName)} ends in 5 minutes`
      : "Your booking ends in 5 minutes",
    data: { type: "booking_end_5min" },
  }),
  venue_booking_created: (p) => ({
    title: "New booking",
    body: p.venueName
      ? `New reservation at ${String(p.venueName)}`
      : "You have a new venue booking",
    data: { type: "venue_booking_created" },
  }),
  venue_booking_canceled: (p) => ({
    title: "Booking canceled",
    body: p.venueName
      ? `A booking at ${String(p.venueName)} was canceled`
      : "A venue booking was canceled",
    data: { type: "venue_booking_canceled" },
  }),
  venue_approved: (p) => ({
    title: "Venue approved",
    body: p.venueName
      ? `${String(p.venueName)} is live on Nooc`
      : "Your venue is approved",
    data: { type: "venue_approved" },
  }),
}

function apnsConfigured() {
  return Boolean(
    process.env.APNS_KEY_ID &&
      process.env.APNS_TEAM_ID &&
      process.env.APNS_BUNDLE_ID &&
      process.env.APNS_PRIVATE_KEY
  )
}

function fcmConfigured() {
  return Boolean(
    process.env.FCM_PROJECT_ID &&
      process.env.FCM_CLIENT_EMAIL &&
      process.env.FCM_PRIVATE_KEY
  )
}

function base64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input)
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

function createApnsJwt(): string | null {
  const keyId = process.env.APNS_KEY_ID!
  const teamId = process.env.APNS_TEAM_ID!
  const privateKey = process.env.APNS_PRIVATE_KEY!.replace(/\\n/g, "\n")
  const header = base64url(JSON.stringify({ alg: "ES256", kid: keyId }))
  const now = Math.floor(Date.now() / 1000)
  const payload = base64url(JSON.stringify({ iss: teamId, iat: now }))
  const unsigned = `${header}.${payload}`
  try {
    const sign = createSign("SHA256")
    sign.update(unsigned)
    sign.end()
    const signature = sign.sign(privateKey)
    return `${unsigned}.${base64url(signature)}`
  } catch (err) {
    console.error("[push] APNs JWT failed:", err)
    return null
  }
}

async function sendApns(deviceToken: string, message: PushPayload) {
  const jwt = createApnsJwt()
  if (!jwt) return { ok: false as const, error: "apns_jwt" }
  const host =
    process.env.APNS_PRODUCTION === "false"
      ? "api.sandbox.push.apple.com"
      : "api.push.apple.com"
  const topic = process.env.APNS_BUNDLE_ID!
  const res = await fetch(`https://${host}/3/device/${deviceToken}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": topic,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      aps: {
        alert: { title: message.title, body: message.body },
        sound: "default",
      },
      ...(message.data ?? {}),
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    return { ok: false as const, error: `apns_${res.status}:${text}` }
  }
  return { ok: true as const }
}

let fcmAccessTokenCache: { token: string; expiresAt: number } | null = null

async function getFcmAccessToken(): Promise<string | null> {
  if (fcmAccessTokenCache && fcmAccessTokenCache.expiresAt > Date.now() + 60_000) {
    return fcmAccessTokenCache.token
  }
  const clientEmail = process.env.FCM_CLIENT_EMAIL!
  const privateKey = process.env.FCM_PRIVATE_KEY!.replace(/\\n/g, "\n")
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const claim = base64url(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  )
  const unsigned = `${header}.${claim}`
  let assertion: string
  try {
    const sign = createSign("RSA-SHA256")
    sign.update(unsigned)
    sign.end()
    assertion = `${unsigned}.${base64url(sign.sign(privateKey))}`
  } catch (err) {
    console.error("[push] FCM JWT failed:", err)
    return null
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  })
  if (!tokenRes.ok) {
    console.error("[push] FCM token exchange failed", await tokenRes.text())
    return null
  }
  const json = (await tokenRes.json()) as {
    access_token?: string
    expires_in?: number
  }
  if (!json.access_token) return null
  fcmAccessTokenCache = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  }
  return json.access_token
}

async function sendFcm(deviceToken: string, message: PushPayload) {
  const accessToken = await getFcmAccessToken()
  if (!accessToken) return { ok: false as const, error: "fcm_token" }
  const projectId = process.env.FCM_PROJECT_ID!
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          notification: { title: message.title, body: message.body },
          data: message.data,
        },
      }),
    }
  )
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    return { ok: false as const, error: `fcm_${res.status}:${text}` }
  }
  return { ok: true as const }
}

export async function sendPushToUser(
  userId: string,
  message: PushPayload
): Promise<{ sent: number; failed: number; skipped: boolean }> {
  const tokens = await prisma.devicePushToken.findMany({
    where: { userId },
    select: { id: true, token: true, platform: true },
  })
  if (!tokens.length) {
    return { sent: 0, failed: 0, skipped: true }
  }

  let sent = 0
  let failed = 0
  const staleIds: string[] = []

  for (const row of tokens) {
    try {
      if (row.platform === "ios") {
        if (!apnsConfigured()) {
          failed++
          continue
        }
        const result = await sendApns(row.token, message)
        if (result.ok) sent++
        else {
          failed++
          if (result.error.includes("410") || result.error.includes("Unregistered")) {
            staleIds.push(row.id)
          }
        }
      } else if (row.platform === "android") {
        if (!fcmConfigured()) {
          failed++
          continue
        }
        const result = await sendFcm(row.token, message)
        if (result.ok) sent++
        else {
          failed++
          if (result.error.includes("NOT_FOUND") || result.error.includes("UNREGISTERED")) {
            staleIds.push(row.id)
          }
        }
      }
    } catch (err) {
      console.error("[push] send failed:", err)
      failed++
    }
  }

  if (staleIds.length) {
    await prisma.devicePushToken.deleteMany({ where: { id: { in: staleIds } } })
  }

  return { sent, failed, skipped: false }
}

/**
 * Fan out a push for a notification event type when the user has devices.
 * Safe no-op when push credentials or tokens are absent.
 */
export async function maybeSendPushForNotificationEvent(input: {
  type: string
  userId?: string | null
  payload: Record<string, unknown>
}): Promise<void> {
  if (!input.userId) return
  const builder = PUSH_COPY[input.type]
  if (!builder) return
  const message = builder(input.payload)
  if (!message) return
  try {
    await sendPushToUser(input.userId, message)
  } catch (err) {
    console.error("[push] maybeSendPushForNotificationEvent:", err)
  }
}
