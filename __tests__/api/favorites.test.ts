import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockPrisma, createMockSession } from '../setup/mocks'
import {
  createTestUser,
  createTestVenue,
  createTestTable,
  createTestSeat,
  createTestFavoriteVenue,
  createTestFavoriteTable,
  createTestFavoriteSeat,
} from '../helpers/test-utils'

// Mock Prisma before importing the route
const mockPrisma = createMockPrisma()
vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

// Mock auth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn() as any,
}))

// Import route after mocks are set up
const { GET } = await import('@/app/api/favorites/route')

describe('GET /api/favorites', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // Reset mockPrisma
    Object.keys(mockPrisma).forEach((key) => {
      if (key === '$transaction') return
      Object.keys(mockPrisma[key as keyof typeof mockPrisma]).forEach((method) => {
        if (
          typeof mockPrisma[key as keyof typeof mockPrisma][
            method as keyof (typeof mockPrisma)[keyof typeof mockPrisma]
          ] === 'function'
        ) {
          (vi.mocked(
            mockPrisma[key as keyof typeof mockPrisma][
              method as keyof (typeof mockPrisma)[keyof typeof mockPrisma]
            ]
          ) as any).mockReset()
        }
      })
    })

    // Default mock session
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue(createMockSession(createTestUser() as any) as any)
  })

  describe('authentication', () => {
    it('returns 401 if user is not authenticated', async () => {
      const { auth } = await import('@/lib/auth')
      vi.mocked(auth).mockResolvedValue(null as any)

      const response = await GET()
      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toContain('signed in')
    })
  })

  describe('fetch favorites', () => {
    it('returns all favorites for authenticated user', async () => {
      const venue = createTestVenue({ id: 'venue-1' })
      const table = createTestTable({ id: 'table-1', venueId: 'venue-1' })
      const seat = createTestSeat({ id: 'seat-1', tableId: 'table-1' })

      const favoriteVenue = createTestFavoriteVenue({ id: 'fav-venue-1', venueId: 'venue-1' })
      const favoriteTable = createTestFavoriteTable({
        id: 'fav-table-1',
        tableId: 'table-1',
        venueId: 'venue-1',
      })
      const favoriteSeat = createTestFavoriteSeat({
        id: 'fav-seat-1',
        seatId: 'seat-1',
        venueId: 'venue-1',
      })

      vi.mocked(mockPrisma.favoriteVenue.findMany).mockResolvedValue([
        {
          ...favoriteVenue,
          venue: {
            ...venue,
            venueHours: [],
          },
        },
      ])

      vi.mocked(mockPrisma.favoriteTable.findMany).mockResolvedValue([
        {
          ...favoriteTable,
          table: {
            ...table,
            venue: {
              ...venue,
              venueHours: [],
            },
            seats: [seat],
          },
        },
      ])

      vi.mocked(mockPrisma.favoriteSeat.findMany).mockResolvedValue([
        {
          ...favoriteSeat,
          seat: {
            ...seat,
            table: {
              ...table,
              venue: {
                ...venue,
                venueHours: [],
              },
            },
          },
        },
      ])

      const response = await GET()
      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.venues).toHaveLength(1)
      expect(data.venues[0].venue.id).toBe('venue-1')
      expect(data.tables).toHaveLength(1)
      expect(data.tables[0].table.id).toBe('table-1')
      expect(data.seats).toHaveLength(1)
      expect(data.seats[0].seat.id).toBe('seat-1')
    })

    it('returns empty arrays if user has no favorites', async () => {
      vi.mocked(mockPrisma.favoriteVenue.findMany).mockResolvedValue([])
      vi.mocked(mockPrisma.favoriteTable.findMany).mockResolvedValue([])
      vi.mocked(mockPrisma.favoriteSeat.findMany).mockResolvedValue([])

      const response = await GET()
      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.venues).toEqual([])
      expect(data.tables).toEqual([])
      expect(data.seats).toEqual([])
    })
  })
})
