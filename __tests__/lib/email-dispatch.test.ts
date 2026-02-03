import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockFindMany = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    notificationEvent: {
      findMany: mockFindMany,
      update: mockUpdate,
    },
  },
}))

vi.mock('@/lib/email-send', () => ({
  validateEmailEnv: vi.fn().mockReturnValue({ ok: true }),
}))

const { runDispatcher } = await import('@/lib/email-dispatch')

describe('runDispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.EMAIL_FROM = 'support@nooc.io'
    process.env.RESEND_API_KEY = 're_test'
  })

  it('marks event as FAILED with "Unknown event type" when type is not in REGISTRY', async () => {
    const eventId = 'ev-unknown-1'
    mockFindMany.mockResolvedValue([
      {
        id: eventId,
        type: 'unknown_type',
        toEmail: 'user@example.com',
        payload: {},
        status: 'PENDING',
        createdAt: new Date(),
      },
    ])
    mockUpdate.mockResolvedValue({})

    const result = await runDispatcher()

    expect(result.processed).toBe(1)
    expect(result.sent).toBe(0)
    expect(result.failed).toBe(1)
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: eventId },
      data: {
        status: 'FAILED',
        error: 'Unknown event type',
      },
    })
  })
})
