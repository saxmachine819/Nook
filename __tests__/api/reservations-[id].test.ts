import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockPrisma, createMockSession } from '../setup/mocks'
import { createTestDateString, createTestUser, createTestVenue, createTestReservation } from '../helpers/test-utils'

// Mock Prisma before importing the route
const mockPrisma = createMockPrisma()
vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

// Mock auth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

// Mock venue-auth
vi.mock('@/lib/venue-auth', () => ({
  canEditVenue: vi.fn(),
}))

// Import route after mocks are set up
const { PATCH } = await import('@/app/api/reservations/[id]/route')

describe('PATCH /api/reservations/[id]', () => {
  let mockRequest: Request
  const reservationId = 'reservation-1'

  beforeEach(async () => {
    vi.clearAllMocks()
    // Reset all mocks
    Object.keys(mockPrisma).forEach((key) => {
      Object.keys(mockPrisma[key as keyof typeof mockPrisma]).forEach((method) => {
        if (typeof mockPrisma[key as keyof typeof mockPrisma][method as keyof typeof mockPrisma[keyof typeof mockPrisma]] === 'function') {
          vi.mocked(mockPrisma[key as keyof typeof mockPrisma][method as keyof typeof mockPrisma[keyof typeof mockPrisma]]).mockReset()
        }
      })
    })

    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue(createMockSession(createTestUser()))

    const { canEditVenue } = await import('@/lib/venue-auth')
    vi.mocked(canEditVenue).mockReturnValue(false)
  })

  describe('authentication', () => {
    it('returns 401 if user is not authenticated', async () => {
      const { auth } = await import('@/lib/auth')
      vi.mocked(auth).mockResolvedValue(null)

      mockRequest = new Request(`http://localhost/api/reservations/${reservationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' }),
      })

      const response = await PATCH(mockRequest, { params: Promise.resolve({ id: reservationId }) })
      expect(response.status).toBe(401)
    })
  })

  describe('reservation not found', () => {
    it('returns 404 if reservation does not exist', async () => {
      vi.mocked(mockPrisma.reservation.findUnique).mockResolvedValue(null)

      mockRequest = new Request(`http://localhost/api/reservations/${reservationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' }),
      })

      const response = await PATCH(mockRequest, { params: Promise.resolve({ id: reservationId }) })
      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toContain('not found')
    })
  })

  describe('authorization', () => {
    beforeEach(async () => {
      const reservation = createTestReservation({ id: reservationId })
      const venue = { id: 'venue-1', ownerId: 'owner-id' }

      vi.mocked(mockPrisma.reservation.findUnique).mockResolvedValue({
        ...reservation,
        venue,
      })
    })

    it('returns 403 if user is not owner or venue owner', async () => {
      const { auth } = await import('@/lib/auth')
      vi.mocked(auth).mockResolvedValue(createMockSession(createTestUser({ id: 'different-user' })))

      mockRequest = new Request(`http://localhost/api/reservations/${reservationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' }),
      })

      const response = await PATCH(mockRequest, { params: Promise.resolve({ id: reservationId }) })
      expect(response.status).toBe(403)
    })

    it('allows reservation owner to cancel', async () => {
      const user = createTestUser({ id: 'reservation-owner' })
      const { auth } = await import('@/lib/auth')
      vi.mocked(auth).mockResolvedValue(createMockSession(user))

      vi.mocked(mockPrisma.reservation.findUnique).mockResolvedValue({
        ...createTestReservation({ id: reservationId, userId: 'reservation-owner' }),
        venue: { id: 'venue-1', ownerId: 'different-owner' },
      })

      vi.mocked(mockPrisma.reservation.update).mockResolvedValue({
        ...createTestReservation({ id: reservationId }),
        status: 'cancelled',
      })

      mockRequest = new Request(`http://localhost/api/reservations/${reservationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' }),
      })

      const response = await PATCH(mockRequest, { params: Promise.resolve({ id: reservationId }) })
      expect(response.status).toBe(200)
    })

    it('allows venue owner to cancel', async () => {
      const venueOwner = createTestUser({ id: 'venue-owner' })
      const { auth } = await import('@/lib/auth')
      vi.mocked(auth).mockResolvedValue(createMockSession(venueOwner))

      const { canEditVenue } = await import('@/lib/venue-auth')
      vi.mocked(canEditVenue).mockReturnValue(true)

      vi.mocked(mockPrisma.reservation.update).mockResolvedValue({
        ...createTestReservation({ id: reservationId }),
        status: 'cancelled',
      })

      mockRequest = new Request(`http://localhost/api/reservations/${reservationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' }),
      })

      const response = await PATCH(mockRequest, { params: Promise.resolve({ id: reservationId }) })
      expect(response.status).toBe(200)
    })
  })

  describe('cancellation', () => {
    beforeEach(async () => {
      const user = createTestUser({ id: 'reservation-owner' })
      const { auth } = await import('@/lib/auth')
      vi.mocked(auth).mockResolvedValue(createMockSession(user))

      vi.mocked(mockPrisma.reservation.findUnique).mockResolvedValue({
        ...createTestReservation({ id: reservationId, userId: 'reservation-owner' }),
        venue: { id: 'venue-1', ownerId: 'different-owner' },
      })
    })

    it('cancels reservation successfully', async () => {
      mockPrisma.reservation.update.mockResolvedValue({
        ...createTestReservation({ id: reservationId }),
        status: 'cancelled',
        venue: createTestVenue(),
        user: { email: 'test@example.com' },
        seat: null,
        table: null,
      })

      mockRequest = new Request(`http://localhost/api/reservations/${reservationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' }),
      })

      const response = await PATCH(mockRequest, { params: Promise.resolve({ id: reservationId }) })
      expect(response.status).toBe(200)
      
      expect(vi.mocked(mockPrisma.reservation.update)).toHaveBeenCalledWith({
        where: { id: reservationId },
        data: { status: 'cancelled' },
        include: expect.any(Object),
      })
    })
  })

  describe('editing reservation', () => {
    beforeEach(async () => {
      const venueOwner = createTestUser({ id: 'venue-owner' })
      const { auth } = await import('@/lib/auth')
      vi.mocked(auth).mockResolvedValue(createMockSession(venueOwner))

      const { canEditVenue } = await import('@/lib/venue-auth')
      vi.mocked(canEditVenue).mockReturnValue(true)

      vi.mocked(mockPrisma.reservation.findUnique).mockResolvedValue({
        ...createTestReservation({ id: reservationId }),
        venue: { id: 'venue-1', ownerId: 'venue-owner' },
      })
    })

    it('prevents reservation owner from editing (only venue owner can)', async () => {
      const reservationOwner = createTestUser({ id: 'reservation-owner' })
      const { auth } = await import('@/lib/auth')
      vi.mocked(auth).mockResolvedValue(createMockSession(reservationOwner))

      const { canEditVenue } = await import('@/lib/venue-auth')
      vi.mocked(canEditVenue).mockReturnValue(false)

      vi.mocked(mockPrisma.reservation.findUnique).mockResolvedValue({
        ...createTestReservation({ id: reservationId, userId: 'reservation-owner' }),
        venue: { id: 'venue-1', ownerId: 'different-owner' },
      })

      mockRequest = new Request(`http://localhost/api/reservations/${reservationId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          startAt: createTestDateString(120),
          endAt: createTestDateString(180),
        }),
      })

      const response = await PATCH(mockRequest, { params: Promise.resolve({ id: reservationId }) })
      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toContain('Only venue owners')
    })

    it('allows venue owner to edit times', async () => {
      vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([]) // No overlapping
      vi.mocked(mockPrisma.seatBlock.findMany).mockResolvedValue([]) // No blocks
      vi.mocked(mockPrisma.reservation.update).mockResolvedValue({
        ...createTestReservation({ id: reservationId }),
        startAt: new Date(createTestDateString(120)),
        endAt: new Date(createTestDateString(180)),
        venue: createTestVenue(),
        user: { email: 'test@example.com' },
        seat: null,
        table: null,
      })

      mockRequest = new Request(`http://localhost/api/reservations/${reservationId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          startAt: createTestDateString(120),
          endAt: createTestDateString(180),
        }),
      })

      const response = await PATCH(mockRequest, { params: Promise.resolve({ id: reservationId }) })
      expect(response.status).toBe(200)
    })

    it('returns 400 if endAt is before startAt', async () => {
      mockRequest = new Request(`http://localhost/api/reservations/${reservationId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          startAt: createTestDateString(120),
          endAt: createTestDateString(60),
        }),
      })

      const response = await PATCH(mockRequest, { params: Promise.resolve({ id: reservationId }) })
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('End time must be after start time')
    })

    it('returns 409 if new time conflicts with existing reservation', async () => {
      // Mock the reservation to have a seatId so we can test seat conflict
      vi.mocked(mockPrisma.reservation.findUnique).mockResolvedValue({
        ...createTestReservation({ id: reservationId, seatId: 'seat-1' }),
        venue: { id: 'venue-1', ownerId: 'venue-owner' },
      })
      
      vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([
        {
          seatId: 'seat-1',
          tableId: null,
        },
      ])
      vi.mocked(mockPrisma.seatBlock.findMany).mockResolvedValue([])

      mockRequest = new Request(`http://localhost/api/reservations/${reservationId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          startAt: createTestDateString(120),
          endAt: createTestDateString(180),
        }),
      })

      const response = await PATCH(mockRequest, { params: Promise.resolve({ id: reservationId }) })
      expect(response.status).toBe(409)
      const data = await response.json()
      expect(data.error).toContain('already reserved')
    })

    it('returns 409 if new seat is blocked', async () => {
      vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([])
      vi.mocked(mockPrisma.seatBlock.findMany).mockResolvedValue([
        {
          id: 'block-1',
          seatId: 'new-seat-id',
          startAt: new Date(createTestDateString(120)),
          endAt: new Date(createTestDateString(180)),
        },
      ])

      mockRequest = new Request(`http://localhost/api/reservations/${reservationId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          seatId: 'new-seat-id',
          startAt: createTestDateString(120),
          endAt: createTestDateString(180),
        }),
      })

      const response = await PATCH(mockRequest, { params: Promise.resolve({ id: reservationId }) })
      expect(response.status).toBe(409)
      const data = await response.json()
      expect(data.error).toContain('blocked')
    })
  })
})
