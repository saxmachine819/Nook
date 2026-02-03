import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockRunDispatcher = vi.fn()
vi.mock('@/lib/email-dispatch', () => ({
  runDispatcher: mockRunDispatcher,
}))

const { GET } = await import('@/app/api/email/dispatch/route')

describe('GET /api/email/dispatch', () => {
  const validSecret = 'test-cron-secret'

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = validSecret
    mockRunDispatcher.mockResolvedValue({ processed: 0, sent: 0, failed: 0 })
  })

  it('returns 401 when Authorization header is missing', async () => {
    const request = new Request('http://localhost/api/email/dispatch', {
      method: 'GET',
    })
    const response = await GET(request)
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
    expect(mockRunDispatcher).not.toHaveBeenCalled()
  })

  it('returns 401 when Bearer token is wrong', async () => {
    const request = new Request('http://localhost/api/email/dispatch', {
      method: 'GET',
      headers: { Authorization: 'Bearer wrong-secret' },
    })
    const response = await GET(request)
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
    expect(mockRunDispatcher).not.toHaveBeenCalled()
  })

  it('returns 200 with processed/sent/failed when valid CRON_SECRET is provided', async () => {
    const request = new Request('http://localhost/api/email/dispatch', {
      method: 'GET',
      headers: { Authorization: `Bearer ${validSecret}` },
    })
    const response = await GET(request)
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty('processed', 0)
    expect(data).toHaveProperty('sent', 0)
    expect(data).toHaveProperty('failed', 0)
    expect(mockRunDispatcher).toHaveBeenCalledTimes(1)
  })
})
