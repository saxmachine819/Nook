import { NextResponse } from "next/server"
import { sendWelcomeEmail } from "@/lib/email-send"

function isValidEmail(value: string): boolean {
  if (!value || typeof value !== "string") return false
  const trimmed = value.trim()
  return trimmed.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    if (process.env.ENABLE_EMAIL_SEND_IN_PRODUCTION !== "true") {
      return NextResponse.json(
        { error: "Not available" },
        { status: 404 }
      )
    }
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  const { to, userName, ctaUrl } = (body as Record<string, unknown>) ?? {}
  if (!to || !isValidEmail(String(to))) {
    return NextResponse.json(
      { error: "Valid 'to' email is required" },
      { status: 400 }
    )
  }

  const result = await sendWelcomeEmail({
    to: String(to).trim(),
    userName: userName != null ? String(userName) : undefined,
    ctaUrl: ctaUrl != null ? String(ctaUrl) : undefined,
  })

  if (!result.ok) {
    return NextResponse.json(
      { error: result.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, id: result.id }, { status: 200 })
}
