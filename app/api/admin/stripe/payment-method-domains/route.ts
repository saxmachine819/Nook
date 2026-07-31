import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/venue-auth"
import { stripe } from "@/lib/stripe"
import {
  DOMAIN_ASSOCIATION_PATH,
  ensureWalletDomains,
  isApplePayReady,
  probeDomainAssociation,
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

async function domainAssociationProbes() {
  const { domains } = resolveWalletDomains()
  return Promise.all(domains.map(probeDomainAssociation))
}

/**
 * Reports what Apple currently thinks of each venue's domains. Read-only, and the only
 * way to see live-mode status without Dashboard access.
 */
export async function GET() {
  const denied = await guard()
  if (denied) return denied

  try {
    const { domains: expectedDomains, skipped } = resolveWalletDomains()
    const venues = await connectedVenues()

    const rows: VenueRow[] = await Promise.all(
      venues.map(async (venue) => {
        const stripeAccountId = venue.stripeAccountId as string
        try {
          const list = await stripe.paymentMethodDomains.list(
            { limit: 100 },
            { stripeAccount: stripeAccountId }
          )

          const domains: WalletDomainResult[] = expectedDomains.map((domain) => {
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
            applePayReady:
              domains.length > 0 && domains.every((entry) => entry.applePay === "active"),
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

    return NextResponse.json({
      expectedDomains,
      skippedHosts: skipped,
      domainAssociationPath: DOMAIN_ASSOCIATION_PATH,
      domainAssociationProbes: await domainAssociationProbes(),
      venuesReady: rows.filter((row) => row.applePayReady).length,
      venuesTotal: rows.length,
      venues: rows,
    })
  } catch (error) {
    console.error("GET /api/admin/stripe/payment-method-domains:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load domain status" },
      { status: 500 }
    )
  }
}

/** Registers and re-verifies the domains on every connected venue. */
export async function POST() {
  const denied = await guard()
  if (denied) return denied

  try {
    const { domains: expectedDomains, skipped } = resolveWalletDomains()
    const venues = await connectedVenues()

    const rows: VenueRow[] = []
    for (const venue of venues) {
      const stripeAccountId = venue.stripeAccountId as string
      const report = await ensureWalletDomains(stripeAccountId)
      rows.push({
        venueId: venue.id,
        venueName: venue.name,
        stripeAccountId,
        domains: report.domains,
        applePayReady: isApplePayReady(report),
        ...(report.errorMessage ? { errorMessage: report.errorMessage } : {}),
      })
    }

    return NextResponse.json({
      expectedDomains,
      skippedHosts: skipped,
      domainAssociationProbes: await domainAssociationProbes(),
      venuesReady: rows.filter((row) => row.applePayReady).length,
      venuesTotal: rows.length,
      venues: rows,
    })
  } catch (error) {
    console.error("POST /api/admin/stripe/payment-method-domains:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to register domains" },
      { status: 500 }
    )
  }
}
