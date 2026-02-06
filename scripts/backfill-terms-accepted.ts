/**
 * One-time backfill: Set termsAcceptedAt for all users who have not yet accepted.
 * Run this after deploying the terms feature so existing users are grandfathered
 * and never see the post-sign-in terms gate.
 *
 * Usage:
 *   npx tsx scripts/backfill-terms-accepted.ts
 */

import { prisma } from "../lib/prisma"

async function backfillTermsAccepted() {
  console.log("Backfilling termsAcceptedAt for existing users...")

  const result = await prisma.user.updateMany({
    where: { termsAcceptedAt: null },
    data: { termsAcceptedAt: new Date() },
  })

  console.log(`Updated ${result.count} user(s). Existing users will not see the terms gate.`)
}

backfillTermsAccepted()
  .then(() => {
    console.log("Backfill completed successfully")
    process.exit(0)
  })
  .catch((error) => {
    console.error("Backfill failed:", error)
    process.exit(1)
  })
