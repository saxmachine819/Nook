import { Resend } from "resend"
import WelcomeEmail from "@/emails/WelcomeEmail"

const REQUIRED_FROM = "support@nooc.io"
const SENDER_DISPLAY_NAME = "nooc"

function getEmailPart(fromTrimmed: string): string | null {
  const part =
    fromTrimmed.includes("<") && fromTrimmed.includes(">")
      ? fromTrimmed.split("<")[1]?.split(">")[0]?.trim()
      : fromTrimmed
  return part ?? null
}

/** Use after validateEmailEnv() succeeds. Returns "nooc <support@nooc.io>". */
export function getFromAddress(): string {
  const from = process.env.EMAIL_FROM!.trim()
  const emailPart = getEmailPart(from) ?? REQUIRED_FROM
  return `${SENDER_DISPLAY_NAME} <${emailPart}>`
}

export interface SendWelcomeResult {
  ok: true
  id: string
}

export interface SendWelcomeError {
  ok: false
  message: string
}

function getEnvError(): string | null {
  const key = process.env.RESEND_API_KEY
  if (!key || typeof key !== "string" || key.trim() === "") {
    return "Email service is not configured."
  }

  const from = process.env.EMAIL_FROM
  if (!from || typeof from !== "string" || from.trim() === "") {
    return "Invalid EMAIL_FROM: must be support@nooc.io"
  }
  const fromTrimmed = from.trim()
  const emailPart = getEmailPart(fromTrimmed)
  if (emailPart !== REQUIRED_FROM) {
    return "Invalid EMAIL_FROM: must be support@nooc.io"
  }

  return null
}

export function validateEmailEnv(): { ok: true } | { ok: false; message: string } {
  const err = getEnvError()
  if (err) return { ok: false, message: err }
  return { ok: true }
}

export interface SendWelcomeOptions {
  to: string
  userName?: string
  ctaUrl?: string
}

export async function sendWelcomeEmail(
  options: SendWelcomeOptions
): Promise<SendWelcomeResult | SendWelcomeError> {
  const envResult = validateEmailEnv()
  if (!envResult.ok) {
    return { ok: false, message: envResult.message }
  }

  const apiKey = process.env.RESEND_API_KEY!
  const resend = new Resend(apiKey)
  const { to, userName, ctaUrl } = options

  const { data, error } = await resend.emails.send({
    from: getFromAddress(),
    to: [to],
    subject: "Welcome to Nooc",
    react: WelcomeEmail({ userName, ctaUrl }),
  })

  if (error) {
    return { ok: false, message: error.message ?? "Failed to send email." }
  }
  if (!data?.id) {
    return { ok: false, message: "Failed to send email." }
  }
  return { ok: true, id: data.id }
}
