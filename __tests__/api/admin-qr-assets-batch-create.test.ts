import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockPrisma } from '../setup/mocks'

// Mock Prisma
const mockPrisma = {
  ...createMockPrisma(),
  qRAsset: {
    findMany: vi.fn(),
    createMany: vi.fn(),
  },
}
vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

// Mock auth
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

// Mock isAdmin
const mockIsAdmin = vi.fn()
vi.mock('@/lib/venue-auth', () => ({
  isAdmin: (user: { email?: string | null } | null | undefined) => mockIsAdmin(user),
}))

// Import route after mocks are set up
const { POST } = await import('@/app/api/admin/qr-assets/batch-create/route')

describe('POST /api/admin/qr-assets/batch-create', () => {
  const adminUser = {
    id: 'admin-id',
    email: 'admin@example.com',
    name: 'Admin User',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.qRAsset.findMany.mockResolvedValue([])
    mockPrisma.qRAsset.createMany.mockResolvedValue({ count: 0 })
  })

  describe('authorization', () => {
    it('returns 401 if user is not authenticated', async () => {
      mockAuth.mockResolvedValue(null)

      const request = new Request('http://localhost/api/admin/qr-assets/batch-create', {
        method: 'POST',
        body: JSON.stringify({ count: 10 }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toContain('signed in')
    })

    it('returns 403 if user is not admin', async () => {
      const regularUser = {
        id: 'user-id',
        email: 'user@example.com',
      }
      mockAuth.mockResolvedValue({ user: regularUser })
      mockIsAdmin.mockReturnValue(false)

      const request = new Request('http://localhost/api/admin/qr-assets/batch-create', {
        method: 'POST',
        body: JSON.stringify({ count: 10 }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('Admin access required')
    })
  })

  describe('input validation', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: adminUser })
      mockIsAdmin.mockReturnValue(true)
    })

    it('defaults to 100 if count is not provided', async () => {
      mockPrisma.qRAsset.createMany.mockResolvedValue({ count: 100 })

      const request = new Request('http://localhost/api/admin/qr-assets/batch-create', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockPrisma.qRAsset.createMany).toHaveBeenCalled()
      const callArgs = mockPrisma.qRAsset.createMany.mock.calls[0][0]
      expect(callArgs.data.length).toBe(100)
    })

    it('returns 400 if count is not a number', async () => {
      const request = new Request('http://localhost/api/admin/qr-assets/batch-create', {
        method: 'POST',
        body: JSON.stringify({ count: 'invalid' }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('must be a number')
    })

    it('returns 400 if count is not an integer', async () => {
      const request = new Request('http://localhost/api/admin/qr-assets/batch-create', {
        method: 'POST',
        body: JSON.stringify({ count: 10.5 }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('between 10 and 5000')
    })

    it('returns 400 if count is less than 10', async () => {
      const request = new Request('http://localhost/api/admin/qr-assets/batch-create', {
        method: 'POST',
        body: JSON.stringify({ count: 5 }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('between 10 and 5000')
    })

    it('returns 400 if count is 0', async () => {
      const request = new Request('http://localhost/api/admin/qr-assets/batch-create', {
        method: 'POST',
        body: JSON.stringify({ count: 0 }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('between 10 and 5000')
    })

    it('returns 400 if count exceeds 5000', async () => {
      const request = new Request('http://localhost/api/admin/qr-assets/batch-create', {
        method: 'POST',
        body: JSON.stringify({ count: 10000 }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('cannot exceed 5000')
    })
  })

  describe('token generation and creation', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: adminUser })
      mockIsAdmin.mockReturnValue(true)
    })

    it('creates tokens with UNREGISTERED status', async () => {
      mockPrisma.qRAsset.createMany.mockResolvedValue({ count: 10 })

      const request = new Request('http://localhost/api/admin/qr-assets/batch-create', {
        method: 'POST',
        body: JSON.stringify({ count: 10 }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockPrisma.qRAsset.createMany).toHaveBeenCalled()
      const callArgs = mockPrisma.qRAsset.createMany.mock.calls[0][0]
      expect(callArgs.data.length).toBe(10)
      expect(callArgs.data[0].status).toBe('UNREGISTERED')
      expect(callArgs.skipDuplicates).toBe(true)
    })

    it('returns created count, batchId, and sample tokens', async () => {
      mockPrisma.qRAsset.createMany.mockResolvedValue({ count: 10 })

      const request = new Request('http://localhost/api/admin/qr-assets/batch-create', {
        method: 'POST',
        body: JSON.stringify({ count: 10 }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.created).toBe(10)
      expect(data.batchId).toBeDefined()
      expect(data.batchId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      )
      expect(data.sampleTokens).toBeDefined()
      expect(Array.isArray(data.sampleTokens)).toBe(true)
      expect(data.sampleTokens.length).toBeLessThanOrEqual(5)
    })

    it('checks for existing tokens before creating', async () => {
      mockPrisma.qRAsset.createMany.mockResolvedValue({ count: 10 })

      const request = new Request('http://localhost/api/admin/qr-assets/batch-create', {
        method: 'POST',
        body: JSON.stringify({ count: 10 }),
      })
      await POST(request)

      // Should check for existing tokens
      expect(mockPrisma.qRAsset.findMany).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: adminUser })
      mockIsAdmin.mockReturnValue(true)
    })

    it('handles database errors gracefully', async () => {
      mockPrisma.qRAsset.findMany.mockRejectedValue(new Error('Database error'))

      const request = new Request('http://localhost/api/admin/qr-assets/batch-create', {
        method: 'POST',
        body: JSON.stringify({ count: 10 }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBeDefined()
    })

    it('handles invalid JSON body', async () => {
      const request = new Request('http://localhost/api/admin/qr-assets/batch-create', {
        method: 'POST',
        body: 'invalid json',
      })
      const response = await POST(request)
      const data = await response.json()

      // Should default to 100 when body parsing fails
      expect(response.status).toBe(200)
    })
  })
})
