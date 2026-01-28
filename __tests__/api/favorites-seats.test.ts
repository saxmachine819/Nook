import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockPrisma, createMockSession } from '../setup/mocks'
import { createTestUser, createTestVenue, createTestTable, createTestSeat, createTestFavoriteSeat, createTestFavoriteVenue } from '../helpers/test-utils'

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
const { POST } = await import('@/app/api/favorites/seats/[seatId]/route')

describe('POST /api/favorites/seats/[seatId]', () => {
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

      const context = { params: Promise.resolve({ seatId: 'seat-1' }) }
      mockRequest = new Request('http://localhost/api/favorites/seats/seat-1', {
        method: 'POST',
        body: JSON.stringify({ venueId: 'venue-1' }),
      })

      const response = await POST(mockRequest, context)
      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toContain('signed in')
    })
  })

  describe('validation', () => {
    it('returns 400 if venueId is missing', async () => {
      const context = { params: Promise.resolve({ seatId: 'seat-1' }) }
      mockRequest = new Request('http://localhost/api/favorites/seats/seat-1', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(mockRequest, context)
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('venueId')
    })

    it('returns 404 if seat does not exist', async () => {
      vi.mocked(mockPrisma.seat.findUnique).mockResolvedValue(null)

      const context = { params: Promise.resolve({ seatId: 'non-existent-seat' }) }
      mockRequest = new Request('http://localhost/api/favorites/seats/non-existent-seat', {
        method: 'POST',
        body: JSON.stringify({ venueId: 'venue-1' }),
      })

      const response = await POST(mockRequest, context)
      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toContain('not found')
    })

    it('returns 400 if seat does not belong to venueId', async () => {
      const venue1 = createTestVenue({ id: 'venue-1' })
      const venue2 = createTestVenue({ id: 'venue-2' })
      const table = createTestTable({ id: 'table-1', venueId: 'venue-2' })
      const seat = createTestSeat({ id: 'seat-1', tableId: 'table-1' })
      vi.mocked(mockPrisma.seat.findUnique).mockResolvedValue({
        ...seat,
        table: {
          ...table,
          venue: venue2,
        },
      })

      const context = { params: Promise.resolve({ seatId: 'seat-1' }) }
      mockRequest = new Request('http://localhost/api/favorites/seats/seat-1', {
        method: 'POST',
        body: JSON.stringify({ venueId: 'venue-1' }),
      })

      const response = await POST(mockRequest, context)
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('does not belong')
    })
  })

  describe('toggle favorite', () => {
    beforeEach(() => {
      const venue = createTestVenue({ id: 'venue-1' })
      const table = createTestTable({ id: 'table-1', venueId: 'venue-1' })
      const seat = createTestSeat({ id: 'seat-1', tableId: 'table-1' })
      vi.mocked(mockPrisma.seat.findUnique).mockResolvedValue({
        ...seat,
        table: {
          ...table,
          venue,
        },
      })
    })

    it('creates FavoriteSeat and FavoriteVenue (cascade) if not exists', async () => {
      vi.mocked(mockPrisma.favoriteSeat.findUnique).mockResolvedValue(null)
      
      // Mock transaction
      vi.mocked(mockPrisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          favoriteSeat: {
            create: vi.fn().mockResolvedValue(createTestFavoriteSeat({ id: 'fav-seat-1' })),
          },
          favoriteVenue: {
            upsert: vi.fn().mockResolvedValue(createTestFavoriteVenue({ id: 'fav-venue-1' })),
          },
        }
        return callback(tx)
      })

      const context = { params: Promise.resolve({ seatId: 'seat-1' }) }
      mockRequest = new Request('http://localhost/api/favorites/seats/seat-1', {
        method: 'POST',
        body: JSON.stringify({ venueId: 'venue-1' }),
      })

      const response = await POST(mockRequest, context)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.favorited).toBe(true)
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })

    it('deletes FavoriteSeat if exists', async () => {
      const existing = createTestFavoriteSeat({ id: 'fav-seat-1', seatId: 'seat-1' })
      vi.mocked(mockPrisma.favoriteSeat.findUnique).mockResolvedValue(existing)
      vi.mocked(mockPrisma.favoriteSeat.delete).mockResolvedValue(existing)

      const context = { params: Promise.resolve({ seatId: 'seat-1' }) }
      mockRequest = new Request('http://localhost/api/favorites/seats/seat-1', {
        method: 'POST',
        body: JSON.stringify({ venueId: 'venue-1' }),
      })

      const response = await POST(mockRequest, context)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.favorited).toBe(false)
      expect(mockPrisma.favoriteSeat.delete).toHaveBeenCalled()
    })
  })
})
