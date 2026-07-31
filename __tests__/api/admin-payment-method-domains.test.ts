import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const mockPrisma = {
  venue: {
    findMany: vi.fn(),
  },
}
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

const mockDomainsList = vi.fn()
vi.mock('@/lib/stripe', () => ({
  stripe: {
    paymentMethodDomains: {
      list: (...args: unknown[]) => mockDomainsList(...args),
    },
  },
}))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockIsAdmin = vi.fn()
vi.mock('@/lib/venue-auth', () => ({
  isAdmin: (user: { email?: string | null } | null | undefined) => mockIsAdmin(user),
}))

const mockEnsureWalletDomains = vi.fn()
vi.mock('@/lib/stripe-payment-method-domains', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/stripe-payment-method-domains')
  >('@/lib/stripe-payment-method-domains')
  return {
    ...actual,
    ensureWalletDomains: (...args: unknown[]) => mockEnsureWalletDomains(...args),
    probeDomainAssociation: async (domain: string) => ({
      domain,
      url: `https://${domain}/.well-known/apple-developer-merchantid-domain-association`,
      status: 200,
      ok: true,
    }),
  }
})

const { GET, POST } = await import('@/app/api/admin/stripe/payment-method-domains/route')

function request(headers: Record<string, string> = {}) {
  return new Request('https://staging.nooc.io/api/admin/stripe/payment-method-domains', {
    headers: { host: 'staging.nooc.io', ...headers },
  })
}

describe('/api/admin/stripe/payment-method-domains', () => {
  const previousCronSecret = process.env.CRON_SECRET
  const previousDomains = process.env.STRIPE_PAYMENT_METHOD_DOMAINS

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
    process.env.STRIPE_PAYMENT_METHOD_DOMAINS = 'staging.nooc.io'
    mockPrisma.venue.findMany.mockResolvedValue([
      { id: 'venue-1', name: 'Café Maud', stripeAccountId: 'acct_1' },
    ])
  })

  afterEach(() => {
    process.env.CRON_SECRET = previousCronSecret
    if (previousDomains === undefined) {
      delete process.env.STRIPE_PAYMENT_METHOD_DOMAINS
    } else {
      process.env.STRIPE_PAYMENT_METHOD_DOMAINS = previousDomains
    }
  })

  it('rejects an anonymous caller', async () => {
    mockAuth.mockResolvedValue(null)

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(mockPrisma.venue.findMany).not.toHaveBeenCalled()
  })

  it('rejects a signed-in non-admin', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', email: 'user@example.com' } })
    mockIsAdmin.mockReturnValue(false)

    const response = await GET(request())

    expect(response.status).toBe(403)
  })

  it('reports Apple Pay status for an admin', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', email: 'admin@example.com' } })
    mockIsAdmin.mockReturnValue(true)
    mockDomainsList.mockResolvedValue({
      data: [
        {
          id: 'pmd_1',
          domain_name: 'staging.nooc.io',
          enabled: true,
          apple_pay: { status: 'active' },
          google_pay: { status: 'active' },
          link: { status: 'active' },
        },
      ],
    })

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.venuesReady).toBe(1)
    expect(body.venues[0]).toMatchObject({
      venueName: 'Café Maud',
      applePayReady: true,
    })
  })

  it('flags a venue whose account is missing the domain', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', email: 'admin@example.com' } })
    mockIsAdmin.mockReturnValue(true)
    mockDomainsList.mockResolvedValue({ data: [] })

    const body = await (await GET(request())).json()

    expect(body.venuesReady).toBe(0)
    expect(body.venues[0].domains[0]).toMatchObject({
      domain: 'staging.nooc.io',
      applePay: 'unknown',
      errorMessage: 'Not registered on this account',
    })
  })

  it('accepts the cron secret so a scheduler can backfill', async () => {
    mockEnsureWalletDomains.mockResolvedValue({
      stripeAccountId: 'acct_1',
      domains: [
        {
          domain: 'staging.nooc.io',
          created: true,
          applePay: 'active',
          googlePay: 'active',
          link: 'active',
        },
      ],
      skipped: [],
    })

    const response = await POST(request({ Authorization: 'Bearer cron-secret' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mockAuth).not.toHaveBeenCalled()
    expect(mockEnsureWalletDomains).toHaveBeenCalledWith('acct_1', {
      domains: ['staging.nooc.io'],
    })
    expect(body.venuesReady).toBe(1)
  })

  it('rejects a wrong bearer token', async () => {
    mockAuth.mockResolvedValue(null)

    const response = await POST(request({ Authorization: 'Bearer nope' }))

    expect(response.status).toBe(401)
    expect(mockEnsureWalletDomains).not.toHaveBeenCalled()
  })
})
