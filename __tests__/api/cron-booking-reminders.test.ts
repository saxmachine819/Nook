import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockPrisma } from '../setup/mocks'

const mockPrisma = createMockPrisma()
vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

vi.mock('@/lib/notification-queue', () => ({
  enqueueNotification: vi.fn().mockResolvedValue(undefined),
}))

const { GET } = await import('@/app/api/cron/booking-end-reminders/route')

describe('GET /api/cron/booking-end-reminders', () => {
  const validSecret = 'test-cron-secret'

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = validSecret
    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([])
  })

  it('returns 401 when Authorization header is missing', async () => {
    const request = new Request('http://localhost/api/cron/booking-end-reminders', {
      method: 'GET',
    })
    const response = await GET(request)
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 401 when Bearer token is wrong', async () => {
    const request = new Request('http://localhost/api/cron/booking-end-reminders', {
      method: 'GET',
      headers: { Authorization: 'Bearer wrong-secret' },
    })
    const response = await GET(request)
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 200 with enqueued/skipped when valid CRON_SECRET is provided', async () => {
    const request = new Request('http://localhost/api/cron/booking-end-reminders', {
      method: 'GET',
      headers: { Authorization: `Bearer ${validSecret}` },
    })
    const response = await GET(request)
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty('enqueued', 0)
    expect(data).toHaveProperty('skipped', 0)
  })
})
