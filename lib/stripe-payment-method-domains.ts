import type Stripe from "stripe"
import { stripe } from "@/lib/stripe"

/**
 * Apple Pay, Google Pay and Link only render in Stripe Elements or in Checkout's
 * embeddable payment form on domains that are registered as payment method domains.
 * With Connect direct charges the registration has to live on the connected account
 * that owns the charge, so every venue needs its own copy.
 *
 * See https://docs.stripe.com/payments/payment-methods/pmd-registration
 */

export const DOMAIN_ASSOCIATION_PATH =
  "/.well-known/apple-developer-merchantid-domain-association"

export type WalletStatus = "active" | "inactive" | "unknown"

export interface WalletDomainResult {
  domain: string
  created: boolean
  applePay: WalletStatus
  googlePay: WalletStatus
  link: WalletStatus
  /** Apple's explanation when the domain failed verification. */
  applePayError?: string
  /** Set when the Stripe call itself failed rather than the verification. */
  errorMessage?: string
}

export interface WalletDomainReport {
  stripeAccountId: string
  domains: WalletDomainResult[]
  /** Hosts that were dropped because Apple can't verify them (localhost, IPs, ...). */
  skipped: string[]
  errorMessage?: string
}

export interface DomainAssociationProbe {
  domain: string
  url: string
  status: number | null
  /** Apple needs a direct 200; a redirect fails verification even though browsers follow it. */
  ok: boolean
  redirectedTo?: string
  errorMessage?: string
}

type PaymentMethodDomainsClient = Pick<Stripe, "paymentMethodDomains">

function normalizeHost(value: string): string | null {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return null

  const withProtocol = trimmed.includes("://") ? trimmed : `https://${trimmed}`
  try {
    const { hostname } = new URL(withProtocol)
    return hostname || null
  } catch {
    return null
  }
}

/**
 * Apple verifies ownership by fetching a file over public HTTPS, so anything that
 * isn't a real public hostname is rejected. Registering them anyway leaves permanently
 * inactive entries on the connected account.
 */
export function isVerifiableHost(host: string): boolean {
  if (!host) return false
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return false
  }
  if (host.includes(":")) return false
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false
  return host.includes(".")
}

function dedupe(hosts: string[]): string[] {
  return Array.from(new Set(hosts))
}

/**
 * Visitors reach checkout on the apex or on `www`, and Apple treats them as separate
 * domains, so an apex host gets its `www` counterpart registered alongside it.
 */
function withWwwCounterpart(host: string): string[] {
  const labels = host.split(".")
  if (labels.length === 2) {
    return [host, `www.${host}`]
  }
  return [host]
}

/**
 * The domains customers can see the payment form on.
 *
 * `STRIPE_PAYMENT_METHOD_DOMAINS` (comma separated) wins when set and is used verbatim,
 * which is how an environment opts out of a host that can't pass verification — the
 * nooc.io apex redirects to www, and Apple rejects redirects.
 */
export function resolveWalletDomains(
  env: NodeJS.ProcessEnv = process.env
): { domains: string[]; skipped: string[] } {
  const configured = env.STRIPE_PAYMENT_METHOD_DOMAINS

  const candidates = configured
    ? configured.split(",")
    : [env.NEXT_PUBLIC_APP_URL, env.NEXTAUTH_URL].filter(
        (value): value is string => !!value
      )

  const hosts = candidates
    .map(normalizeHost)
    .filter((host): host is string => !!host)

  const expanded = configured ? hosts : hosts.flatMap(withWwwCounterpart)

  return {
    domains: dedupe(expanded.filter(isVerifiableHost)),
    skipped: dedupe(expanded.filter((host) => !isVerifiableHost(host))),
  }
}

function toResult(
  domain: string,
  record: Stripe.PaymentMethodDomain,
  created: boolean
): WalletDomainResult {
  return {
    domain,
    created,
    applePay: record.apple_pay.status,
    googlePay: record.google_pay.status,
    link: record.link.status,
    ...(record.apple_pay.status_details?.error_message
      ? { applePayError: record.apple_pay.status_details.error_message }
      : {}),
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Registers every customer-facing domain on a connected account and re-runs Apple's
 * verification on anything that isn't active yet. Idempotent, and it never throws —
 * callers get a report so a wallet problem is visible instead of silently swallowed.
 */
export async function ensureWalletDomains(
  stripeAccountId: string,
  options: {
    domains?: string[]
    client?: PaymentMethodDomainsClient
  } = {}
): Promise<WalletDomainReport> {
  const client = options.client ?? stripe
  const resolved = resolveWalletDomains()
  const domains = options.domains ?? resolved.domains
  const skipped = options.domains ? [] : resolved.skipped

  const report: WalletDomainReport = { stripeAccountId, domains: [], skipped }
  if (domains.length === 0) {
    return report
  }

  const requestOptions = { stripeAccount: stripeAccountId }

  let existing: Stripe.PaymentMethodDomain[] = []
  try {
    const list = await client.paymentMethodDomains.list({ limit: 100 }, requestOptions)
    existing = list.data
  } catch (error) {
    report.errorMessage = errorMessage(error)
    return report
  }

  for (const domain of domains) {
    let created = false
    try {
      let record = existing.find((entry) => entry.domain_name === domain)

      if (!record) {
        record = await client.paymentMethodDomains.create(
          { domain_name: domain, enabled: true },
          requestOptions
        )
        created = true
      } else if (!record.enabled) {
        record = await client.paymentMethodDomains.update(
          record.id,
          { enabled: true },
          requestOptions
        )
      }

      if (record.apple_pay.status !== "active") {
        record = await client.paymentMethodDomains.validate(record.id, {}, requestOptions)
      }

      report.domains.push(toResult(domain, record, created))
    } catch (error) {
      report.domains.push({
        domain,
        created,
        applePay: "unknown",
        googlePay: "unknown",
        link: "unknown",
        errorMessage: errorMessage(error),
      })
    }
  }

  return report
}

const READY_CACHE_TTL_MS = 30 * 60 * 1000
const readyCache = new Map<string, { report: WalletDomainReport; expiresAt: number }>()

/**
 * Same as `ensureWalletDomains`, but skips the Stripe round trip when this instance
 * already saw the account fully verified. Checkout is latency sensitive and the venue
 * status route is polled, so only failures are retried.
 */
export async function ensureWalletDomainsCached(
  stripeAccountId: string,
  options: { now?: number } = {}
): Promise<WalletDomainReport> {
  const now = options.now ?? Date.now()
  const cached = readyCache.get(stripeAccountId)
  if (cached && cached.expiresAt > now) {
    return cached.report
  }

  const report = await ensureWalletDomains(stripeAccountId)
  if (isApplePayReady(report)) {
    readyCache.set(stripeAccountId, { report, expiresAt: now + READY_CACHE_TTL_MS })
  } else {
    readyCache.delete(stripeAccountId)
  }

  return report
}

export function clearWalletDomainCache(): void {
  readyCache.clear()
}

/** True when Apple Pay is live on every domain we tried to register. */
export function isApplePayReady(report: WalletDomainReport): boolean {
  return (
    !report.errorMessage &&
    report.domains.length > 0 &&
    report.domains.every((entry) => entry.applePay === "active")
  )
}

export function summarizeWalletDomainReport(report: WalletDomainReport): string {
  if (report.errorMessage) {
    return `${report.stripeAccountId}: lookup failed (${report.errorMessage})`
  }
  if (report.domains.length === 0) {
    return `${report.stripeAccountId}: no verifiable domains configured`
  }
  const parts = report.domains.map((entry) => {
    const detail = entry.errorMessage ?? entry.applePayError
    return `${entry.domain} apple_pay=${entry.applePay}${entry.created ? " (registered)" : ""}${
      detail ? ` — ${detail}` : ""
    }`
  })
  return `${report.stripeAccountId}: ${parts.join("; ")}`
}

/**
 * Checks that the domain serves Apple's verification file directly. A redirect or a 404
 * here is why an otherwise correct registration stays inactive.
 */
export async function probeDomainAssociation(
  domain: string
): Promise<DomainAssociationProbe> {
  const url = `https://${domain}${DOMAIN_ASSOCIATION_PATH}`
  try {
    const response = await fetch(url, { redirect: "manual", cache: "no-store" })
    const location = response.headers.get("location")
    return {
      domain,
      url,
      status: response.status,
      ok: response.status === 200,
      ...(location ? { redirectedTo: location } : {}),
    }
  } catch (error) {
    return {
      domain,
      url,
      status: null,
      ok: false,
      errorMessage: errorMessage(error),
    }
  }
}
