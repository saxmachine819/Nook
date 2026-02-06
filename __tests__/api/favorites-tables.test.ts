import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockPrisma, createMockSession } from '../setup/mocks'
import { createTestUser, createTestVenue, createTestTable, createTestFavoriteTable, createTestFavoriteVenue } from '../helpers/test-utils'

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
const { POST } = await import('@/app/api/favorites/tables/[tableId]/route')

describe('POST /api/favorites/tables/[tableId]', () => {
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

      const context = { params: Promise.resolve({ tableId: 'table-1' }) }
      mockRequest = new Request('http://localhost/api/favorites/tables/table-1', {
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
      const context = { params: Promise.resolve({ tableId: 'table-1' }) }
      mockRequest = new Request('http://localhost/api/favorites/tables/table-1', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(mockRequest, context)
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('venueId')
    })

    it('returns 404 if table does not exist', async () => {
      vi.mocked(mockPrisma.table.findUnique).mockResolvedValue(null)

      const context = { params: Promise.resolve({ tableId: 'non-existent-table' }) }
      mockRequest = new Request('http://localhost/api/favorites/tables/non-existent-table', {
        method: 'POST',
        body: JSON.stringify({ venueId: 'venue-1' }),
      })

      const response = await POST(mockRequest, context)
      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toContain('not found')
    })

    it('returns 400 if table does not belong to venueId', async () => {
      const venue = createTestVenue({ id: 'venue-1' })
      const table = createTestTable({ id: 'table-1', venueId: 'venue-2' }) // Different venue
      vi.mocked(mockPrisma.table.findUnique).mockResolvedValue({
        ...table,
        venue,
      })

      const context = { params: Promise.resolve({ tableId: 'table-1' }) }
      mockRequest = new Request('http://localhost/api/favorites/tables/table-1', {
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
      vi.mocked(mockPrisma.table.findUnique).mockResolvedValue({
        ...table,
        venue,
      })
    })

    it('creates FavoriteTable and FavoriteVenue (cascade) if not exists', async () => {
      vi.mocked(mockPrisma.favoriteTable.findUnique).mockResolvedValue(null)
      
      // Mock transaction
      vi.mocked(mockPrisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          favoriteTable: {
            create: vi.fn().mockResolvedValue(createTestFavoriteTable({ id: 'fav-table-1' })),
          },
          favoriteVenue: {
            upsert: vi.fn().mockResolvedValue(createTestFavoriteVenue({ id: 'fav-venue-1' })),
          },
        }
        return callback(tx)
      })

      const context = { params: Promise.resolve({ tableId: 'table-1' }) }
      mockRequest = new Request('http://localhost/api/favorites/tables/table-1', {
        method: 'POST',
        body: JSON.stringify({ venueId: 'venue-1' }),
      })

      const response = await POST(mockRequest, context)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.favorited).toBe(true)
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })

    it('deletes FavoriteTable if exists', async () => {
      const existing = createTestFavoriteTable({ id: 'fav-table-1', tableId: 'table-1' })
      vi.mocked(mockPrisma.favoriteTable.findUnique).mockResolvedValue(existing)
      vi.mocked(mockPrisma.favoriteTable.delete).mockResolvedValue(existing)

      const context = { params: Promise.resolve({ tableId: 'table-1' }) }
      mockRequest = new Request('http://localhost/api/favorites/tables/table-1', {
        method: 'POST',
        body: JSON.stringify({ venueId: 'venue-1' }),
      })

      const response = await POST(mockRequest, context)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.favorited).toBe(false)
      expect(mockPrisma.favoriteTable.delete).toHaveBeenCalled()
    })
  })
})
