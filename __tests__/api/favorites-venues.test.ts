import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockPrisma, createMockSession } from '../setup/mocks'
import { createTestUser, createTestVenue, createTestFavoriteVenue } from '../helpers/test-utils'

// Mock Prisma before importing the route
const mockPrisma = createMockPrisma()
vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

// Mock auth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

// Import route after mocks are set up
const { POST } = await import('@/app/api/favorites/venues/[venueId]/route')

describe('POST /api/favorites/venues/[venueId]', () => {
  let mockRequest: Request

  beforeEach(async () => {
    vi.clearAllMocks()
    // Reset mockPrisma
    Object.keys(mockPrisma).forEach((key) => {
      if (key === '$transaction') return
      Object.keys(mockPrisma[key as keyof typeof mockPrisma]).forEach((method) => {
        if (typeof mockPrisma[key as keyof typeof mockPrisma][method as keyof typeof mockPrisma[keyof typeof mockPrisma]] === 'function') {
          vi.mocked(mockPrisma[key as keyof typeof mockPrisma][method as keyof typeof mockPrisma[keyof typeof mockPrisma]]).mockReset()
        }
      })
    })

    // Default mock session
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue(createMockSession(createTestUser()))
  })

  describe('authentication', () => {
    it('returns 401 if user is not authenticated', async () => {
      const { auth } = await import('@/lib/auth')
      vi.mocked(auth).mockResolvedValue(null)

      const context = { params: Promise.resolve({ venueId: 'venue-1' }) }
      mockRequest = new Request('http://localhost/api/favorites/venues/venue-1', {
        method: 'POST',
      })

      const response = await POST(mockRequest, context)
      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toContain('signed in')
    })

    it('returns 401 if session user has no id', async () => {
      const { auth } = await import('@/lib/auth')
      vi.mocked(auth).mockResolvedValue({ user: { email: 'test@example.com' } })

      const context = { params: Promise.resolve({ venueId: 'venue-1' }) }
      mockRequest = new Request('http://localhost/api/favorites/venues/venue-1', {
        method: 'POST',
      })

      const response = await POST(mockRequest, context)
      expect(response.status).toBe(401)
    })
  })

  describe('venue validation', () => {
    it('returns 404 if venue does not exist', async () => {
      vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue(null)

      const context = { params: Promise.resolve({ venueId: 'non-existent-venue' }) }
      mockRequest = new Request('http://localhost/api/favorites/venues/non-existent-venue', {
        method: 'POST',
      })

      const response = await POST(mockRequest, context)
      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toContain('not found')
    })
  })

  describe('toggle favorite', () => {
    beforeEach(() => {
      const venue = createTestVenue({ id: 'venue-1' })
      vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue(venue)
    })

    it('creates FavoriteVenue if not exists', async () => {
      vi.mocked(mockPrisma.favoriteVenue.findUnique).mockResolvedValue(null)
      vi.mocked(mockPrisma.favoriteVenue.create).mockResolvedValue(
        createTestFavoriteVenue({ id: 'fav-1', venueId: 'venue-1' })
      )

      const context = { params: Promise.resolve({ venueId: 'venue-1' }) }
      mockRequest = new Request('http://localhost/api/favorites/venues/venue-1', {
        method: 'POST',
      })

      const response = await POST(mockRequest, context)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.favorited).toBe(true)
      expect(mockPrisma.favoriteVenue.create).toHaveBeenCalledWith({
        data: {
          userId: 'test-user-id',
          venueId: 'venue-1',
        },
      })
    })

    it('deletes FavoriteVenue and cascades to related favorites if exists', async () => {
      const existing = createTestFavoriteVenue({ id: 'fav-1', venueId: 'venue-1' })
      vi.mocked(mockPrisma.favoriteVenue.findUnique).mockResolvedValue(existing)
      
      // Mock transaction
      vi.mocked(mockPrisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          favoriteVenue: {
            delete: vi.fn().mockResolvedValue(existing),
          },
          favoriteTable: {
            deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
          },
          favoriteSeat: {
            deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
          },
        }
        return callback(tx)
      })

      const context = { params: Promise.resolve({ venueId: 'venue-1' }) }
      mockRequest = new Request('http://localhost/api/favorites/venues/venue-1', {
        method: 'POST',
      })

      const response = await POST(mockRequest, context)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.favorited).toBe(false)
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })
  })
})
