/**
 * Registers the customer-facing domains as Stripe payment method domains on every
 * venue's connected account and re-runs Apple's verification where it hasn't passed.
 * Without this, Apple Pay never appears in embedded Checkout.
 *
 * The domains come from STRIPE_PAYMENT_METHOD_DOMAINS, or NEXT_PUBLIC_APP_URL /
 * NEXTAUTH_URL when that isn't set. Uses whichever Stripe key is in the environment,
 * so run it with the live key to fix production.
 *
 * Usage:
 *   npx tsx scripts/ensure-payment-method-domains.ts
 *   npx tsx scripts/ensure-payment-method-domains.ts --dry-run
 *   npx tsx scripts/ensure-payment-method-domains.ts --account acct_123
 */

import { prisma } from "../lib/prisma"
import {
  ensureWalletDomains,
  isApplePayReady,
  probeDomainAssociation,
  resolveWalletDomains,
  summarizeWalletDomainReport,
} from "../lib/stripe-payment-method-domains"

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")
  const accountFlag = args.indexOf("--account")
  const onlyAccount = accountFlag >= 0 ? args[accountFlag + 1] : null

  const { domains, skipped } = resolveWalletDomains()

  console.log(`Domains to register: ${domains.join(", ") || "(none)"}`)
  if (skipped.length > 0) {
    console.log(`Skipped (Apple cannot verify these): ${skipped.join(", ")}`)
  }

  if (domains.length === 0) {
    console.error(
      "No verifiable domains. Set STRIPE_PAYMENT_METHOD_DOMAINS or NEXT_PUBLIC_APP_URL to a public https host."
    )
    process.exitCode = 1
    return
  }

  console.log("\nApple domain association file:")
  for (const domain of domains) {
    const probe = await probeDomainAssociation(domain)
    const detail = probe.redirectedTo
      ? ` → redirects to ${probe.redirectedTo} (Apple rejects redirects)`
      : probe.errorMessage
        ? ` (${probe.errorMessage})`
        : ""
    console.log(`  ${probe.ok ? "OK " : "BAD"} ${probe.url} [${probe.status}]${detail}`)
  }

  const venues = await prisma.venue.findMany({
    where: onlyAccount
      ? { stripeAccountId: onlyAccount }
      : { stripeAccountId: { not: null } },
    select: { id: true, name: true, stripeAccountId: true },
    orderBy: { name: "asc" },
  })

  console.log(`\n${venues.length} venue(s) with a connected Stripe account`)

  if (dryRun) {
    for (const venue of venues) {
      console.log(`  ${venue.name} — ${venue.stripeAccountId}`)
    }
    console.log("\nDry run: nothing was changed.")
    return
  }

  let ready = 0
  for (const venue of venues) {
    const report = await ensureWalletDomains(venue.stripeAccountId as string)
    if (isApplePayReady(report)) ready++
    console.log(`  ${venue.name} — ${summarizeWalletDomainReport(report)}`)
  }

  console.log(`\nApple Pay active on all domains for ${ready}/${venues.length} venue(s).`)
  if (ready < venues.length) {
    process.exitCode = 1
  }
}

main()
  .catch((error) => {
    console.error("Fatal error:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
