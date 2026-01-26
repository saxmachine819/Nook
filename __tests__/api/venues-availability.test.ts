import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockPrisma } from '../setup/mocks'
import { createTestVenue, createTestTable, createTestSeat, createTestDateString } from '../helpers/test-utils'

// Mock Prisma before importing the route
const mockPrisma = createMockPrisma()
vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

// Import route after mocks are set up
const { GET } = await import('@/app/api/venues/[id]/availability/route')

describe('GET /api/venues/[id]/availability', () => {
  const venueId = 'venue-1'

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset all mocks
    Object.keys(mockPrisma).forEach((key) => {
      Object.keys(mockPrisma[key as keyof typeof mockPrisma]).forEach((method) => {
        if (typeof mockPrisma[key as keyof typeof mockPrisma][method as keyof typeof mockPrisma[keyof typeof mockPrisma]] === 'function') {
          vi.mocked(mockPrisma[key as keyof typeof mockPrisma][method as keyof typeof mockPrisma[keyof typeof mockPrisma]]).mockReset()
        }
      })
    })
  })

  describe('seat-level availability (startAt/endAt params)', () => {
    it('returns 400 if startAt or endAt is missing', async () => {
      const request = new Request(`http://localhost/api/venues/${venueId}/availability?startAt=${createTestDateString(60)}`)
      const response = await GET(request, { params: Promise.resolve({ id: venueId }) })
      expect(response.status).toBe(400)
    })

    it('returns 400 if dates are invalid', async () => {
      const request = new Request(`http://localhost/api/venues/${venueId}/availability?startAt=invalid&endAt=invalid`)
      const response = await GET(request, { params: Promise.resolve({ id: venueId }) })
      expect(response.status).toBe(400)
    })

    it('returns 400 if endAt is before startAt', async () => {
      const request = new Request(
        `http://localhost/api/venues/${venueId}/availability?startAt=${createTestDateString(120)}&endAt=${createTestDateString(60)}`
      )
      const response = await GET(request, { params: Promise.resolve({ id: venueId }) })
      expect(response.status).toBe(400)
    })

    it('returns 404 if venue does not exist', async () => {
      vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue(null)

      const request = new Request(
        `http://localhost/api/venues/${venueId}/availability?startAt=${createTestDateString(60)}&endAt=${createTestDateString(120)}`
      )
      const response = await GET(request, { params: Promise.resolve({ id: venueId }) })
      expect(response.status).toBe(404)
    })

    it('returns available seats for single seat booking', async () => {
      const venue = createTestVenue({ id: venueId })
      const table = createTestTable({ venueId: venue.id })
      const seats = [
        createTestSeat({ id: 'seat-1', tableId: table.id }),
        createTestSeat({ id: 'seat-2', tableId: table.id }),
      ]

      vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue({
        ...venue,
        tables: [
          {
            ...table,
            seats,
          },
        ],
      })
      vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([])
      vi.mocked(mockPrisma.seatBlock.findMany).mockResolvedValue([])

      const request = new Request(
        `http://localhost/api/venues/${venueId}/availability?startAt=${createTestDateString(60)}&endAt=${createTestDateString(120)}&seatCount=1`
      )
      const response = await GET(request, { params: Promise.resolve({ id: venueId }) })
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.availableSeats).toHaveLength(2)
      expect(data.unavailableSeatIds).toHaveLength(0)
    })

    it('excludes reserved seats from availability', async () => {
      const venue = createTestVenue({ id: venueId })
      const table = createTestTable({ venueId: venue.id })
      const seats = [
        createTestSeat({ id: 'seat-1', tableId: table.id }),
        createTestSeat({ id: 'seat-2', tableId: table.id }),
      ]

      vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue({
        ...venue,
        tables: [
          {
            ...table,
            seats,
          },
        ],
      })
      vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([
        {
          seatId: 'seat-1',
          tableId: null,
          endAt: new Date(createTestDateString(120)),
        },
      ])
      vi.mocked(mockPrisma.seatBlock.findMany).mockResolvedValue([])

      const request = new Request(
        `http://localhost/api/venues/${venueId}/availability?startAt=${createTestDateString(60)}&endAt=${createTestDateString(120)}&seatCount=1`
      )
      const response = await GET(request, { params: Promise.resolve({ id: venueId }) })
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.availableSeats).toHaveLength(1)
      expect(data.availableSeats[0].id).toBe('seat-2')
      expect(data.unavailableSeatIds).toContain('seat-1')
    })

    it('excludes blocked seats from availability', async () => {
      const venue = createTestVenue({ id: venueId })
      const table = createTestTable({ venueId: venue.id })
      const seats = [
        createTestSeat({ id: 'seat-1', tableId: table.id }),
        createTestSeat({ id: 'seat-2', tableId: table.id }),
      ]

      vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue({
        ...venue,
        tables: [
          {
            ...table,
            seats,
          },
        ],
      })
      vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([])
      vi.mocked(mockPrisma.seatBlock.findMany).mockResolvedValue([
        {
          seatId: 'seat-1',
          startAt: new Date(createTestDateString(60)),
          endAt: new Date(createTestDateString(120)),
        },
      ])

      const request = new Request(
        `http://localhost/api/venues/${venueId}/availability?startAt=${createTestDateString(60)}&endAt=${createTestDateString(120)}&seatCount=1`
      )
      const response = await GET(request, { params: Promise.resolve({ id: venueId }) })
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.availableSeats).toHaveLength(1)
      expect(data.availableSeats[0].id).toBe('seat-2')
      expect(data.unavailableSeatIds).toContain('seat-1')
    })

    it('blocks all seats for venue-wide blocks', async () => {
      const venue = createTestVenue({ id: venueId })
      const table = createTestTable({ venueId: venue.id })
      const seats = [
        createTestSeat({ id: 'seat-1', tableId: table.id }),
        createTestSeat({ id: 'seat-2', tableId: table.id }),
      ]

      vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue({
        ...venue,
        tables: [
          {
            ...table,
            seats,
          },
        ],
      })
      vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([])
      vi.mocked(mockPrisma.seatBlock.findMany).mockResolvedValue([
        {
          seatId: null, // Venue-wide block
          startAt: new Date(createTestDateString(60)),
          endAt: new Date(createTestDateString(120)),
        },
      ])

      const request = new Request(
        `http://localhost/api/venues/${venueId}/availability?startAt=${createTestDateString(60)}&endAt=${createTestDateString(120)}&seatCount=1`
      )
      const response = await GET(request, { params: Promise.resolve({ id: venueId }) })
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.availableSeats).toHaveLength(0)
      expect(data.unavailableSeatIds).toContain('seat-1')
      expect(data.unavailableSeatIds).toContain('seat-2')
    })

    it('returns 200 with error message if seatCount exceeds capacity', async () => {
      const venue = createTestVenue({ id: venueId })
      const table = createTestTable({ venueId: venue.id, seatCount: 2 })
      const seats = [
        createTestSeat({ id: 'seat-1', tableId: table.id }),
        createTestSeat({ id: 'seat-2', tableId: table.id }),
      ]

      vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue({
        ...venue,
        tables: [
          {
            ...table,
            seats,
          },
        ],
      })

      const request = new Request(
        `http://localhost/api/venues/${venueId}/availability?startAt=${createTestDateString(60)}&endAt=${createTestDateString(120)}&seatCount=10`
      )
      const response = await GET(request, { params: Promise.resolve({ id: venueId }) })
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.error).toContain('only has 2 seat')
    })
  })

  describe('slot-based availability (date param)', () => {
    it('returns 400 if date is missing', async () => {
      const request = new Request(`http://localhost/api/venues/${venueId}/availability`)
      const response = await GET(request, { params: Promise.resolve({ id: venueId }) })
      expect(response.status).toBe(400)
    })

    it('returns slots for a given date', async () => {
      const venue = createTestVenue({ id: venueId })
      const table = createTestTable({ venueId: venue.id, seatCount: 4 })

      vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue({
        ...venue,
        tables: [table],
        reservations: [],
      })

      const date = '2024-01-22'
      const request = new Request(`http://localhost/api/venues/${venueId}/availability?date=${date}`)
      const response = await GET(request, { params: Promise.resolve({ id: venueId }) })
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.capacity).toBe(4)
      expect(data.slots).toBeInstanceOf(Array)
      expect(data.slots.length).toBeGreaterThan(0)
    })

    it('calculates available seats correctly considering reservations', async () => {
      const venue = createTestVenue({ id: venueId })
      const table = createTestTable({ venueId: venue.id, seatCount: 4 })
      const date = '2024-01-22'
      const slotStart = new Date(`${date}T14:00:00`)
      const slotEnd = new Date(`${date}T14:15:00`)

      vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue({
        ...venue,
        tables: [table],
        reservations: [
          {
            id: 'res-1',
            startAt: slotStart,
            endAt: slotEnd,
            seatCount: 2,
            status: 'active',
          },
        ],
      })

      const request = new Request(`http://localhost/api/venues/${venueId}/availability?date=${date}`)
      const response = await GET(request, { params: Promise.resolve({ id: venueId }) })
      expect(response.status).toBe(200)
      
      const data = await response.json()
      const slot = data.slots.find((s: any) => s.start === slotStart.toISOString())
      expect(slot.availableSeats).toBe(2) // 4 capacity - 2 reserved = 2 available
    })

    it('returns 400 if venue has no seats', async () => {
      const venue = createTestVenue({ id: venueId })

      vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue({
        ...venue,
        tables: [],
        reservations: [],
      })

      const request = new Request(`http://localhost/api/venues/${venueId}/availability?date=2024-01-22`)
      const response = await GET(request, { params: Promise.resolve({ id: venueId }) })
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('no reservable seats')
    })
  })
})
