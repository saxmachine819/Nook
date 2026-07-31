import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/venue-auth"
import { stripe } from "@/lib/stripe"
import {
  DOMAIN_ASSOCIATION_PATH,
  ensureWalletDomains,
  probeDomainAssociation,
  requestHost,
  resolveRequestDomains,
  resolveWalletDomains,
  type WalletDomainResult,
} from "@/lib/stripe-payment-method-domains"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface VenueRow {
  venueId: string
  venueName: string
  stripeAccountId: string
  domains: WalletDomainResult[]
  applePayReady: boolean
  errorMessage?: string
}

async function guard() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 })
  }

  if (!isAdmin(session.user)) {
    return NextResponse.json(
      { error: "Unauthorized: Admin access required" },
      { status: 403 }
    )
  }

  return null
}

function connectedVenues() {
  return prisma.venue.findMany({
    where: { stripeAccountId: { not: null } },
    select: { id: true, name: true, stripeAccountId: true },
    orderBy: { name: "asc" },
  })
}

/**
 * The host being audited comes first: environment variables go stale, and a domain whose
 * association file isn't served can never verify, so it's reported but not counted.
 */
async function domainContext(request: Request) {
  const configured = resolveWalletDomains()
  const domains = Array.from(
    new Set([...resolveRequestDomains(requestHost(request)), ...configured.domains])
  )
  const probes = await Promise.all(domains.map(probeDomainAssociation))
  const verifiable = probes.filter((probe) => probe.ok).map((probe) => probe.domain)

  return { domains, probes, verifiable, skipped: configured.skipped }
}

function readiness(domains: WalletDomainResult[], verifiable: string[]): boolean {
  const relevant = domains.filter((entry) => verifiable.includes(entry.domain))
  return relevant.length > 0 && relevant.every((entry) => entry.applePay === "active")
}

function payload(
  context: Awaited<ReturnType<typeof domainContext>>,
  rows: VenueRow[]
) {
  return {
    expectedDomains: context.domains,
    verifiableDomains: context.verifiable,
    skippedHosts: context.skipped,
    domainAssociationPath: DOMAIN_ASSOCIATION_PATH,
    domainAssociationProbes: context.probes,
    venuesReady: rows.filter((row) => row.applePayReady).length,
    venuesTotal: rows.length,
    venues: rows,
  }
}

/**
 * Reports what Apple currently thinks of each venue's domains. Read-only, and the only
 * way to see live-mode status without Dashboard access.
 */
export async function GET(request: Request) {
  const denied = await guard()
  if (denied) return denied

  try {
    const context = await domainContext(request)
    const venues = await connectedVenues()

    const rows: VenueRow[] = await Promise.all(
      venues.map(async (venue) => {
        const stripeAccountId = venue.stripeAccountId as string
        try {
          const list = await stripe.paymentMethodDomains.list(
            { limit: 100 },
            { stripeAccount: stripeAccountId }
          )

          const domains: WalletDomainResult[] = context.domains.map((domain) => {
            const record = list.data.find((entry) => entry.domain_name === domain)
            if (!record) {
              return {
                domain,
                created: false,
                applePay: "unknown",
                googlePay: "unknown",
                link: "unknown",
                errorMessage: "Not registered on this account",
              }
            }
            return {
              domain,
              created: false,
              applePay: record.enabled ? record.apple_pay.status : "inactive",
              googlePay: record.google_pay.status,
              link: record.link.status,
              ...(record.apple_pay.status_details?.error_message
                ? { applePayError: record.apple_pay.status_details.error_message }
                : {}),
              ...(record.enabled ? {} : { errorMessage: "Domain is disabled" }),
            }
          })

          return {
            venueId: venue.id,
            venueName: venue.name,
            stripeAccountId,
            domains,
            applePayReady: readiness(domains, context.verifiable),
          }
        } catch (error) {
          return {
            venueId: venue.id,
            venueName: venue.name,
            stripeAccountId,
            domains: [],
            applePayReady: false,
            errorMessage: error instanceof Error ? error.message : String(error),
          }
        }
      })
    )

    return NextResponse.json(payload(context, rows))
  } catch (error) {
    console.error("GET /api/admin/stripe/payment-method-domains:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load domain status" },
      { status: 500 }
    )
  }
}

/** Registers and re-verifies the domains on every connected venue. */
export async function POST(request: Request) {
  const denied = await guard()
  if (denied) return denied

  try {
    const context = await domainContext(request)
    const venues = await connectedVenues()

    const rows: VenueRow[] = []
    for (const venue of venues) {
      const stripeAccountId = venue.stripeAccountId as string
      const report = await ensureWalletDomains(stripeAccountId, {
        domains: context.verifiable,
      })
      rows.push({
        venueId: venue.id,
        venueName: venue.name,
        stripeAccountId,
        domains: report.domains,
        applePayReady: readiness(report.domains, context.verifiable),
        ...(report.errorMessage ? { errorMessage: report.errorMessage } : {}),
      })
    }

    return NextResponse.json(payload(context, rows))
  } catch (error) {
    console.error("POST /api/admin/stripe/payment-method-domains:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to register domains" },
      { status: 500 }
    )
  }
}
