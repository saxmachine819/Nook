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
const { GET } = await import('@/app/api/admin/venues/route')

describe('GET /api/admin/venues', () => {
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

      const request = new Request('http://localhost/api/admin/venues')
      const response = await GET(request)
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

      const request = new Request('http://localhost/api/admin/venues')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('Admin access required')
    })
  })

  describe('venue list', () => {
    it('returns venues with owner information', async () => {
      mockAuth.mockResolvedValue({ user: adminUser })
      mockIsAdmin.mockReturnValue(true)

      const mockVenues = [
        {
          id: 'venue-1',
          name: 'Test Venue',
          address: '123 Test St',
          onboardingStatus: 'APPROVED',
          createdAt: new Date('2024-01-01'),
          owner: {
            id: 'owner-1',
            email: 'owner@example.com',
            name: 'Owner',
          },
        },
      ]

      mockPrisma.venue.findMany.mockResolvedValue(mockVenues)

      const request = new Request('http://localhost/api/admin/venues')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.venues).toBeDefined()
      expect(data.venues[0].ownerEmail).toBe('owner@example.com')
      expect(mockPrisma.venue.findMany).toHaveBeenCalled()
    })

    it('filters venues by search query', async () => {
      mockAuth.mockResolvedValue({ user: adminUser })
      mockIsAdmin.mockReturnValue(true)

      mockPrisma.venue.findMany.mockResolvedValue([])

      const request = new Request('http://localhost/api/admin/venues?search=test')
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockPrisma.venue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: expect.any(Object) }),
              expect.objectContaining({ address: expect.any(Object) }),
            ]),
          }),
        })
      )
    })
  })
})

// Test owner reassignment endpoint
describe('POST /api/admin/venues/[id]/reassign-owner', () => {
  const adminUser = {
    id: 'admin-id',
    email: 'admin@example.com',
    name: 'Admin User',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 if user is not authenticated', async () => {
    mockAuth.mockResolvedValue(null)

    const { POST: POSTReassign } = await import('@/app/api/admin/venues/[id]/reassign-owner/route')
    const request = new Request('http://localhost/api/admin/venues/venue-1/reassign-owner', {
      method: 'POST',
      body: JSON.stringify({ ownerEmail: 'newowner@example.com' }),
    })
    const response = await POSTReassign(request as any, { params: Promise.resolve({ id: 'venue-1' }) })
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

    const { POST: POSTReassign } = await import('@/app/api/admin/venues/[id]/reassign-owner/route')
    const request = new Request('http://localhost/api/admin/venues/venue-1/reassign-owner', {
      method: 'POST',
      body: JSON.stringify({ ownerEmail: 'newowner@example.com' }),
    })
    const response = await POSTReassign(request as any, { params: Promise.resolve({ id: 'venue-1' }) })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toContain('Admin access required')
  })

  it('returns 400 if ownerEmail is missing', async () => {
    mockAuth.mockResolvedValue({ user: adminUser })
    mockIsAdmin.mockReturnValue(true)

    const { POST: POSTReassign } = await import('@/app/api/admin/venues/[id]/reassign-owner/route')
    const request = new Request('http://localhost/api/admin/venues/venue-1/reassign-owner', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const response = await POSTReassign(request as any, { params: Promise.resolve({ id: 'venue-1' }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('ownerEmail is required')
  })

  it('returns 400 if email format is invalid', async () => {
    mockAuth.mockResolvedValue({ user: adminUser })
    mockIsAdmin.mockReturnValue(true)

    const { POST: POSTReassign } = await import('@/app/api/admin/venues/[id]/reassign-owner/route')
    const request = new Request('http://localhost/api/admin/venues/venue-1/reassign-owner', {
      method: 'POST',
      body: JSON.stringify({ ownerEmail: 'invalid-email' }),
    })
    const response = await POSTReassign(request as any, { params: Promise.resolve({ id: 'venue-1' }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Invalid email format')
  })

  it('returns 404 if venue not found', async () => {
    mockAuth.mockResolvedValue({ user: adminUser })
    mockIsAdmin.mockReturnValue(true)
    mockPrisma.venue.findUnique.mockResolvedValue(null)

    const { POST: POSTReassign } = await import('@/app/api/admin/venues/[id]/reassign-owner/route')
    const request = new Request('http://localhost/api/admin/venues/venue-1/reassign-owner', {
      method: 'POST',
      body: JSON.stringify({ ownerEmail: 'newowner@example.com' }),
    })
    const response = await POSTReassign(request as any, { params: Promise.resolve({ id: 'venue-1' }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('not found')
  })

  it('returns 404 if user not found', async () => {
    mockAuth.mockResolvedValue({ user: adminUser })
    mockIsAdmin.mockReturnValue(true)
    mockPrisma.venue.findUnique.mockResolvedValue({
      id: 'venue-1',
      name: 'Test Venue',
    })
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const { POST: POSTReassign } = await import('@/app/api/admin/venues/[id]/reassign-owner/route')
    const request = new Request('http://localhost/api/admin/venues/venue-1/reassign-owner', {
      method: 'POST',
      body: JSON.stringify({ ownerEmail: 'nonexistent@example.com' }),
    })
    const response = await POSTReassign(request as any, { params: Promise.resolve({ id: 'venue-1' }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('not found')
  })

  it('successfully reassigns venue owner', async () => {
    mockAuth.mockResolvedValue({ user: adminUser })
    mockIsAdmin.mockReturnValue(true)
    mockPrisma.venue.findUnique.mockResolvedValue({
      id: 'venue-1',
      name: 'Test Venue',
    })
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'new-owner-id',
      email: 'newowner@example.com',
      name: 'New Owner',
    })
    mockPrisma.venue.update.mockResolvedValue({
      id: 'venue-1',
      name: 'Test Venue',
      owner: {
        id: 'new-owner-id',
        email: 'newowner@example.com',
        name: 'New Owner',
      },
    })

    const { POST: POSTReassign } = await import('@/app/api/admin/venues/[id]/reassign-owner/route')
    const request = new Request('http://localhost/api/admin/venues/venue-1/reassign-owner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerEmail: 'newowner@example.com' }),
    })
    const response = await POSTReassign(request as any, { params: Promise.resolve({ id: 'venue-1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.venue.ownerEmail).toBe('newowner@example.com')
    expect(mockPrisma.venue.update).toHaveBeenCalledWith({
      where: { id: 'venue-1' },
      data: { ownerId: 'new-owner-id' },
      select: expect.any(Object),
    })
  })
})
