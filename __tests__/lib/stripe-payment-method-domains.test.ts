import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  clearWalletDomainCache,
  ensureWalletDomains,
  ensureWalletDomainsCached,
  isApplePayReady,
  probeDomainAssociation,
  resolveWalletDomains,
  summarizeWalletDomainReport,
} from '@/lib/stripe-payment-method-domains'
import { stripe } from '@/lib/stripe'

vi.mock('@/lib/stripe', () => ({
  stripe: {
    paymentMethodDomains: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      validate: vi.fn(),
    },
  },
}))

type DomainOverrides = {
  id?: string
  domain_name?: string
  enabled?: boolean
  applePay?: 'active' | 'inactive'
  applePayError?: string
}

function domainRecord(overrides: DomainOverrides = {}): any {
  return {
    id: overrides.id ?? 'pmd_1',
    object: 'payment_method_domain',
    domain_name: overrides.domain_name ?? 'www.nooc.io',
    enabled: overrides.enabled ?? true,
    created: 1_700_000_000,
    livemode: false,
    apple_pay: {
      status: overrides.applePay ?? 'active',
      ...(overrides.applePayError
        ? { status_details: { error_message: overrides.applePayError } }
        : {}),
    },
    google_pay: { status: 'active' },
    link: { status: 'active' },
    paypal: { status: 'inactive' },
  }
}

function mockClient() {
  return {
    paymentMethodDomains: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      validate: vi.fn(),
    },
  } as any
}

describe('resolveWalletDomains', () => {
  it('uses STRIPE_PAYMENT_METHOD_DOMAINS verbatim when set', () => {
    const result = resolveWalletDomains({
      STRIPE_PAYMENT_METHOD_DOMAINS: 'www.nooc.io, staging.nooc.io',
      NEXT_PUBLIC_APP_URL: 'https://ignored.example.com',
    } as any)

    expect(result.domains).toEqual(['www.nooc.io', 'staging.nooc.io'])
  })

  it('strips protocol, path and casing from configured values', () => {
    const result = resolveWalletDomains({
      STRIPE_PAYMENT_METHOD_DOMAINS: 'HTTPS://WWW.Nooc.io/checkout',
    } as any)

    expect(result.domains).toEqual(['www.nooc.io'])
  })

  it('adds the www counterpart of an apex host derived from the app url', () => {
    const result = resolveWalletDomains({
      NEXT_PUBLIC_APP_URL: 'https://nooc.io',
    } as any)

    expect(result.domains).toEqual(['nooc.io', 'www.nooc.io'])
  })

  it('does not add an apex counterpart for a subdomain', () => {
    const result = resolveWalletDomains({
      NEXT_PUBLIC_APP_URL: 'https://staging.nooc.io',
    } as any)

    expect(result.domains).toEqual(['staging.nooc.io'])
  })

  it('skips hosts Apple cannot verify', () => {
    const result = resolveWalletDomains({
      NEXT_PUBLIC_APP_URL: 'http://localhost:4321',
      NEXTAUTH_URL: 'http://127.0.0.1:4321',
    } as any)

    expect(result.domains).toEqual([])
    expect(result.skipped).toEqual(['localhost', '127.0.0.1'])
  })

  it('dedupes the app url and auth url', () => {
    const result = resolveWalletDomains({
      NEXT_PUBLIC_APP_URL: 'https://www.nooc.io',
      NEXTAUTH_URL: 'https://www.nooc.io',
    } as any)

    expect(result.domains).toEqual(['www.nooc.io'])
  })
})

describe('ensureWalletDomains', () => {
  it('registers a domain that is missing from the account', async () => {
    const client = mockClient()
    client.paymentMethodDomains.list.mockResolvedValue({ data: [] })
    client.paymentMethodDomains.create.mockResolvedValue(domainRecord())

    const report = await ensureWalletDomains('acct_1', {
      client,
      domains: ['www.nooc.io'],
    })

    expect(client.paymentMethodDomains.create).toHaveBeenCalledWith(
      { domain_name: 'www.nooc.io', enabled: true },
      { stripeAccount: 'acct_1' }
    )
    expect(report.domains[0]).toMatchObject({
      domain: 'www.nooc.io',
      created: true,
      applePay: 'active',
    })
    expect(isApplePayReady(report)).toBe(true)
  })

  it('does not re-create a domain that already exists', async () => {
    const client = mockClient()
    client.paymentMethodDomains.list.mockResolvedValue({ data: [domainRecord()] })

    const report = await ensureWalletDomains('acct_1', {
      client,
      domains: ['www.nooc.io'],
    })

    expect(client.paymentMethodDomains.create).not.toHaveBeenCalled()
    expect(client.paymentMethodDomains.validate).not.toHaveBeenCalled()
    expect(report.domains[0].created).toBe(false)
  })

  it('re-runs verification when Apple Pay is inactive', async () => {
    const client = mockClient()
    client.paymentMethodDomains.list.mockResolvedValue({
      data: [domainRecord({ applePay: 'inactive', applePayError: 'File not found' })],
    })
    client.paymentMethodDomains.validate.mockResolvedValue(
      domainRecord({ applePay: 'active' })
    )

    const report = await ensureWalletDomains('acct_1', {
      client,
      domains: ['www.nooc.io'],
    })

    expect(client.paymentMethodDomains.validate).toHaveBeenCalledWith(
      'pmd_1',
      {},
      { stripeAccount: 'acct_1' }
    )
    expect(report.domains[0].applePay).toBe('active')
  })

  it('verifies a domain right after registering it', async () => {
    const client = mockClient()
    client.paymentMethodDomains.list.mockResolvedValue({ data: [] })
    client.paymentMethodDomains.create.mockResolvedValue(
      domainRecord({ applePay: 'inactive' })
    )
    client.paymentMethodDomains.validate.mockResolvedValue(
      domainRecord({ applePay: 'active' })
    )

    const report = await ensureWalletDomains('acct_1', {
      client,
      domains: ['www.nooc.io'],
    })

    expect(client.paymentMethodDomains.validate).toHaveBeenCalledTimes(1)
    expect(report.domains[0]).toMatchObject({ created: true, applePay: 'active' })
  })

  it('re-enables a disabled domain', async () => {
    const client = mockClient()
    client.paymentMethodDomains.list.mockResolvedValue({
      data: [domainRecord({ enabled: false })],
    })
    client.paymentMethodDomains.update.mockResolvedValue(domainRecord())

    await ensureWalletDomains('acct_1', { client, domains: ['www.nooc.io'] })

    expect(client.paymentMethodDomains.update).toHaveBeenCalledWith(
      'pmd_1',
      { enabled: true },
      { stripeAccount: 'acct_1' }
    )
  })

  it('reports a failure for one domain and keeps going', async () => {
    const client = mockClient()
    client.paymentMethodDomains.list.mockResolvedValue({ data: [] })
    client.paymentMethodDomains.create
      .mockRejectedValueOnce(new Error('Invalid domain name'))
      .mockResolvedValueOnce(domainRecord({ domain_name: 'staging.nooc.io' }))

    const report = await ensureWalletDomains('acct_1', {
      client,
      domains: ['nooc.io', 'staging.nooc.io'],
    })

    expect(report.domains).toHaveLength(2)
    expect(report.domains[0]).toMatchObject({
      domain: 'nooc.io',
      applePay: 'unknown',
      errorMessage: 'Invalid domain name',
    })
    expect(report.domains[1].applePay).toBe('active')
    expect(isApplePayReady(report)).toBe(false)
  })

  it('does not throw when the account lookup fails', async () => {
    const client = mockClient()
    client.paymentMethodDomains.list.mockRejectedValue(new Error('No such account'))

    const report = await ensureWalletDomains('acct_1', {
      client,
      domains: ['www.nooc.io'],
    })

    expect(report.errorMessage).toBe('No such account')
    expect(report.domains).toEqual([])
    expect(isApplePayReady(report)).toBe(false)
  })

  it('makes no Stripe calls when there is nothing verifiable to register', async () => {
    const client = mockClient()

    const report = await ensureWalletDomains('acct_1', { client, domains: [] })

    expect(client.paymentMethodDomains.list).not.toHaveBeenCalled()
    expect(isApplePayReady(report)).toBe(false)
  })

  it('summarizes a report for logging', async () => {
    const client = mockClient()
    client.paymentMethodDomains.list.mockResolvedValue({
      data: [domainRecord({ applePay: 'inactive', applePayError: 'File not found' })],
    })
    client.paymentMethodDomains.validate.mockResolvedValue(
      domainRecord({ applePay: 'inactive', applePayError: 'File not found' })
    )

    const report = await ensureWalletDomains('acct_1', {
      client,
      domains: ['www.nooc.io'],
    })

    expect(summarizeWalletDomainReport(report)).toContain('apple_pay=inactive')
    expect(summarizeWalletDomainReport(report)).toContain('File not found')
  })
})

describe('ensureWalletDomainsCached', () => {
  const previous = process.env.STRIPE_PAYMENT_METHOD_DOMAINS

  beforeEach(() => {
    process.env.STRIPE_PAYMENT_METHOD_DOMAINS = 'www.nooc.io'
    clearWalletDomainCache()
    vi.mocked(stripe.paymentMethodDomains.list).mockReset()
    vi.mocked(stripe.paymentMethodDomains.validate).mockReset()
  })

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.STRIPE_PAYMENT_METHOD_DOMAINS
    } else {
      process.env.STRIPE_PAYMENT_METHOD_DOMAINS = previous
    }
    clearWalletDomainCache()
  })

  it('skips the Stripe round trip once the account is verified', async () => {
    vi.mocked(stripe.paymentMethodDomains.list).mockResolvedValue({
      data: [domainRecord()],
    } as any)

    await ensureWalletDomainsCached('acct_1')
    const second = await ensureWalletDomainsCached('acct_1')

    expect(stripe.paymentMethodDomains.list).toHaveBeenCalledTimes(1)
    expect(isApplePayReady(second)).toBe(true)
  })

  it('retries while Apple Pay is still inactive', async () => {
    vi.mocked(stripe.paymentMethodDomains.list).mockResolvedValue({
      data: [domainRecord({ applePay: 'inactive' })],
    } as any)
    vi.mocked(stripe.paymentMethodDomains.validate).mockResolvedValue(
      domainRecord({ applePay: 'inactive' }) as any
    )

    await ensureWalletDomainsCached('acct_1')
    await ensureWalletDomainsCached('acct_1')

    expect(stripe.paymentMethodDomains.list).toHaveBeenCalledTimes(2)
  })

  it('expires the cache entry', async () => {
    vi.mocked(stripe.paymentMethodDomains.list).mockResolvedValue({
      data: [domainRecord()],
    } as any)

    const now = Date.now()
    await ensureWalletDomainsCached('acct_1', { now })
    await ensureWalletDomainsCached('acct_1', { now: now + 31 * 60 * 1000 })

    expect(stripe.paymentMethodDomains.list).toHaveBeenCalledTimes(2)
  })
})

describe('probeDomainAssociation', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('passes when the file is served directly', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers(),
    }) as any

    const probe = await probeDomainAssociation('www.nooc.io')

    expect(probe.ok).toBe(true)
    expect(probe.url).toBe(
      'https://www.nooc.io/.well-known/apple-developer-merchantid-domain-association'
    )
  })

  it('fails a redirect and reports where it points', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 307,
      headers: new Headers({ location: 'https://www.nooc.io/.well-known/x' }),
    }) as any

    const probe = await probeDomainAssociation('nooc.io')

    expect(probe.ok).toBe(false)
    expect(probe.redirectedTo).toBe('https://www.nooc.io/.well-known/x')
  })

  it('reports a network failure instead of throwing', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND')) as any

    const probe = await probeDomainAssociation('nope.nooc.io')

    expect(probe.ok).toBe(false)
    expect(probe.errorMessage).toBe('getaddrinfo ENOTFOUND')
  })
})
