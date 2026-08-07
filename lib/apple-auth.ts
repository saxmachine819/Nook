import { SignJWT, importPKCS8 } from "jose"

/**
 * Build an Apple client secret JWT for Sign in with Apple / NextAuth.
 * Prefer APPle_SECRET if already provided; otherwise generate from key material.
 */
export async function getAppleClientSecret(): Promise<string | null> {
  if (process.env.APPLE_SECRET?.trim()) {
    return process.env.APPLE_SECRET.trim()
  }

  const teamId = process.env.APPLE_TEAM_ID
  const clientId = process.env.APPLE_ID
  const keyId = process.env.APPLE_KEY_ID
  const privateKeyPem = process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, "\n")

  if (!teamId || !clientId || !keyId || !privateKeyPem) {
    return null
  }

  try {
    const key = await importPKCS8(privateKeyPem, "ES256")
    const now = Math.floor(Date.now() / 1000)
    return await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: keyId })
      .setIssuer(teamId)
      .setIssuedAt(now)
      .setExpirationTime(now + 60 * 60 * 24 * 150) // ~150 days (Apple max 6 months)
      .setAudience("https://appleid.apple.com")
      .setSubject(clientId)
      .sign(key)
  } catch (err) {
    console.error("[auth] Failed to generate Apple client secret:", err)
    return null
  }
}

export function isAppleSignInConfigured(): boolean {
  if (process.env.APPLE_SECRET?.trim() && process.env.APPLE_ID?.trim()) {
    return true
  }
  return Boolean(
    process.env.APPLE_ID &&
      process.env.APPLE_TEAM_ID &&
      process.env.APPLE_KEY_ID &&
      process.env.APPLE_PRIVATE_KEY
  )
}
