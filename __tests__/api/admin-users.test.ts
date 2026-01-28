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
const { GET } = await import('@/app/api/admin/users/route')

describe('GET /api/admin/users', () => {
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

      const request = new Request('http://localhost/api/admin/users')
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

      const request = new Request('http://localhost/api/admin/users')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('Admin access required')
    })
  })

  describe('user list', () => {
    it('returns users with insights', async () => {
      mockAuth.mockResolvedValue({ user: adminUser })
      mockIsAdmin.mockReturnValue(true)

      const mockUsers = [
        {
          id: 'user-1',
          name: 'Test User',
          email: 'test@example.com',
          createdAt: new Date('2024-01-01'),
          venues: [{ id: 'venue-1' }, { id: 'venue-2' }],
          reservations: [{ id: 'res-1', createdAt: new Date('2024-01-15') }],
        },
      ]

      mockPrisma.user.findMany.mockResolvedValue(mockUsers)
      mockPrisma.reservation.count.mockResolvedValue(5)

      const request = new Request('http://localhost/api/admin/users')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.users).toBeDefined()
      expect(mockPrisma.user.findMany).toHaveBeenCalled()
    })

    it('filters users by search query', async () => {
      mockAuth.mockResolvedValue({ user: adminUser })
      mockIsAdmin.mockReturnValue(true)

      mockPrisma.user.findMany.mockResolvedValue([])
      mockPrisma.reservation.count.mockResolvedValue(0)

      const request = new Request('http://localhost/api/admin/users?search=test@example.com')
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ email: expect.any(Object) }),
              expect.objectContaining({ name: expect.any(Object) }),
            ]),
          }),
        })
      )
    })
  })
})

// Test user detail endpoint
describe('GET /api/admin/users/[id]', () => {
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

    const { GET: GETDetail } = await import('@/app/api/admin/users/[id]/route')
    const request = new Request('http://localhost/api/admin/users/user-1')
    const response = await GETDetail(request, { params: Promise.resolve({ id: 'user-1' }) })
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

    const { GET: GETDetail } = await import('@/app/api/admin/users/[id]/route')
    const request = new Request('http://localhost/api/admin/users/user-1')
    const response = await GETDetail(request, { params: Promise.resolve({ id: 'user-1' }) })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toContain('Admin access required')
  })

  it('returns user detail with venues and reservations', async () => {
    mockAuth.mockResolvedValue({ user: adminUser })
    mockIsAdmin.mockReturnValue(true)

    const mockUser = {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      createdAt: new Date('2024-01-01'),
      venues: [
        {
          id: 'venue-1',
          name: 'Test Venue',
          address: '123 Test St',
          onboardingStatus: 'APPROVED',
        },
      ],
      reservations: [
        {
          id: 'res-1',
          venueId: 'venue-1',
          venue: { id: 'venue-1', name: 'Test Venue' },
          startAt: new Date('2024-01-15T10:00:00Z'),
          endAt: new Date('2024-01-15T12:00:00Z'),
          seatCount: 2,
          status: 'active',
        },
      ],
    }

    mockPrisma.user.findUnique.mockResolvedValue(mockUser)

    const { GET: GETDetail } = await import('@/app/api/admin/users/[id]/route')
    const request = new Request('http://localhost/api/admin/users/user-1')
    const response = await GETDetail(request, { params: Promise.resolve({ id: 'user-1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.user).toBeDefined()
    expect(data.user.venues).toBeDefined()
    expect(data.user.reservations).toBeDefined()
  })

  it('returns 404 if user not found', async () => {
    mockAuth.mockResolvedValue({ user: adminUser })
    mockIsAdmin.mockReturnValue(true)
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const { GET: GETDetail } = await import('@/app/api/admin/users/[id]/route')
    const request = new Request('http://localhost/api/admin/users/user-1')
    const response = await GETDetail(request, { params: Promise.resolve({ id: 'user-1' }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('not found')
  })
})
