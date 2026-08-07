/**
 * Generate an Apple Sign In client secret JWT for NextAuth.
 *
 * Usage:
 *   APPLE_ID=... APPLE_TEAM_ID=... APPLE_KEY_ID=... APPLE_PRIVATE_KEY="..." \
 *     npx tsx scripts/generate-apple-client-secret.ts
 *
 * Copy the printed value into APPLE_SECRET (Vercel + .env). Secrets expire in ~6 months.
 */
import { getAppleClientSecret } from "../lib/apple-auth"

async function main() {
  const secret = await getAppleClientSecret()
  if (!secret) {
    console.error(
      "Missing Apple env. Need APPLE_SECRET already set, or APPLE_ID + APPLE_TEAM_ID + APPLE_KEY_ID + APPLE_PRIVATE_KEY."
    )
    process.exit(1)
  }
  console.log(secret)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
