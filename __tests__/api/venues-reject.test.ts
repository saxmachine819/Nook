import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockPrisma } from '../setup/mocks'

// Mock Prisma
const mockPrisma = createMockPrisma()
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
const { POST } = await import('@/app/api/venues/[id]/reject/route')

describe('POST /api/venues/[id]/reject', () => {
  const venueId = 'venue-1'
  const adminUser = {
    id: 'admin-id',
    email: 'admin@example.com',
    name: 'Admin User',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('authorization', () => {
    it('returns 401 if user is not authenticated', async () => {
      mockAuth.mockResolvedValue(null)

      const request = new Request(`http://localhost/api/venues/${venueId}/reject`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      const response = await POST(request, { params: Promise.resolve({ id: venueId }) })
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

      const request = new Request(`http://localhost/api/venues/${venueId}/reject`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      const response = await POST(request, { params: Promise.resolve({ id: venueId }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('Admin access required')
    })
  })

  describe('venue validation', () => {
    it('returns 404 if venue does not exist', async () => {
      mockAuth.mockResolvedValue({ user: adminUser })
      mockIsAdmin.mockReturnValue(true)
      mockPrisma.venue.findUnique.mockResolvedValue(null)

      const request = new Request(`http://localhost/api/venues/${venueId}/reject`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      const response = await POST(request, { params: Promise.resolve({ id: venueId }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain('not found')
    })

    it('returns 400 if venue is not in SUBMITTED status', async () => {
      mockAuth.mockResolvedValue({ user: adminUser })
      mockIsAdmin.mockReturnValue(true)
      mockPrisma.venue.findUnique.mockResolvedValue({
        id: venueId,
        onboardingStatus: 'APPROVED',
      })

      const request = new Request(`http://localhost/api/venues/${venueId}/reject`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      const response = await POST(request, { params: Promise.resolve({ id: venueId }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('cannot be rejected')
    })
  })

  describe('successful rejection', () => {
    it('rejects venue with reason and sets rejectedByUserId', async () => {
      mockAuth.mockResolvedValue({ user: adminUser })
      mockIsAdmin.mockReturnValue(true)
      mockPrisma.venue.findUnique.mockResolvedValue({
        id: venueId,
        onboardingStatus: 'SUBMITTED',
      })
      mockPrisma.venue.update.mockResolvedValue({
        id: venueId,
        name: 'Test Venue',
        onboardingStatus: 'REJECTED',
        rejectionReason: 'Missing information',
      })

      const request = new Request(`http://localhost/api/venues/${venueId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: 'Missing information' }),
      })
      const response = await POST(request, { params: Promise.resolve({ id: venueId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.venue.onboardingStatus).toBe('REJECTED')
      expect(data.venue.rejectionReason).toBe('Missing information')
      expect(mockPrisma.venue.update).toHaveBeenCalledWith({
        where: { id: venueId },
        data: expect.objectContaining({
          onboardingStatus: 'REJECTED',
          rejectedAt: expect.any(Date),
          rejectedByUserId: adminUser.id,
          rejectionReason: 'Missing information',
          approvedAt: null,
          approvedByUserId: null,
        }),
        select: expect.any(Object),
      })
    })

    it('rejects venue without reason', async () => {
      mockAuth.mockResolvedValue({ user: adminUser })
      mockIsAdmin.mockReturnValue(true)
      mockPrisma.venue.findUnique.mockResolvedValue({
        id: venueId,
        onboardingStatus: 'SUBMITTED',
      })
      mockPrisma.venue.update.mockResolvedValue({
        id: venueId,
        name: 'Test Venue',
        onboardingStatus: 'REJECTED',
        rejectionReason: null,
      })

      const request = new Request(`http://localhost/api/venues/${venueId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const response = await POST(request, { params: Promise.resolve({ id: venueId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.venue.onboardingStatus).toBe('REJECTED')
      expect(mockPrisma.venue.update).toHaveBeenCalledWith({
        where: { id: venueId },
        data: expect.objectContaining({
          rejectionReason: null,
        }),
        select: expect.any(Object),
      })
    })
  })
})
