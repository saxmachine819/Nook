import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockPrisma, createMockSession } from '../setup/mocks'
import { createTestDateString, createPastDateString, createTestUser, createTestVenue, createTestTable, createTestSeat } from '../helpers/test-utils'

// Mock Prisma before importing the route
const mockPrisma = createMockPrisma()
vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

// Mock auth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

// Mock notification queue (enqueue only; no inline send)
vi.mock('@/lib/notification-queue', () => ({
  enqueueNotification: vi.fn().mockResolvedValue(undefined),
}))

// Import route after mocks are set up
const { POST } = await import('@/app/api/reservations/route')
const { enqueueNotification } = await import('@/lib/notification-queue')

describe('POST /api/reservations', () => {
  let mockRequest: Request

  beforeEach(async () => {
    vi.clearAllMocks()
    // Reset mockPrisma
    Object.keys(mockPrisma).forEach((key) => {
      const delegate = mockPrisma[key as keyof typeof mockPrisma]
      if (delegate && typeof delegate === 'object' && !Array.isArray(delegate)) {
        Object.keys(delegate).forEach((method) => {
          const fn = delegate[method as keyof typeof delegate]
          if (typeof fn === 'function' && typeof (fn as any).mockReset === 'function') {
            (fn as any).mockReset()
          }
        })
      }
    })

    // Default mock session
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue(createMockSession(createTestUser()))
  })

  describe('authentication', () => {
    it('returns 401 if user is not authenticated', async () => {
      const { auth } = await import('@/lib/auth')
      vi.mocked(auth).mockResolvedValue(null)

      mockRequest = new Request('http://localhost/api/reservations', {
        method: 'POST',
        body: JSON.stringify({
          venueId: 'venue-1',
          seatId: 'seat-1',
          startAt: createTestDateString(60),
          endAt: createTestDateString(120),
        }),
      })

      const response = await POST(mockRequest)
      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toContain('signed in')
    })

    it('returns 401 if session user has no id', async () => {
      const { auth } = await import('@/lib/auth')
      vi.mocked(auth).mockResolvedValue({ user: { email: 'test@example.com' } })

      mockRequest = new Request('http://localhost/api/reservations', {
        method: 'POST',
        body: JSON.stringify({
          venueId: 'venue-1',
          seatId: 'seat-1',
          startAt: createTestDateString(60),
          endAt: createTestDateString(120),
        }),
      })

      const response = await POST(mockRequest)
      expect(response.status).toBe(401)
    })
  })

  describe('validation', () => {
    beforeEach(() => {
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(createTestUser())
    })

    it('returns 400 if venueId is missing', async () => {
      vi.mocked(enqueueNotification).mockClear()
      mockRequest = new Request('http://localhost/api/reservations', {
        method: 'POST',
        body: JSON.stringify({
          seatId: 'seat-1',
          startAt: createTestDateString(60),
          endAt: createTestDateString(120),
        }),
      })

      const response = await POST(mockRequest)
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Missing required fields')
      expect(enqueueNotification).not.toHaveBeenCalled()
    })

    it('returns 400 if startAt is missing', async () => {
      mockRequest = new Request('http://localhost/api/reservations', {
        method: 'POST',
        body: JSON.stringify({
          venueId: 'venue-1',
          seatId: 'seat-1',
          endAt: createTestDateString(120),
        }),
      })

      const response = await POST(mockRequest)
      expect(response.status).toBe(400)
    })

    it('returns 400 if endAt is missing', async () => {
      mockRequest = new Request('http://localhost/api/reservations', {
        method: 'POST',
        body: JSON.stringify({
          venueId: 'venue-1',
          seatId: 'seat-1',
          startAt: createTestDateString(60),
        }),
      })

      const response = await POST(mockRequest)
      expect(response.status).toBe(400)
    })

    it('returns 400 if endAt is before startAt', async () => {
      mockRequest = new Request('http://localhost/api/reservations', {
        method: 'POST',
        body: JSON.stringify({
          venueId: 'venue-1',
          seatId: 'seat-1',
          startAt: createTestDateString(120),
          endAt: createTestDateString(60),
        }),
      })

      const response = await POST(mockRequest)
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('End time must be after start time')
    })

    it('returns 400 if dates are invalid', async () => {
      mockRequest = new Request('http://localhost/api/reservations', {
        method: 'POST',
        body: JSON.stringify({
          venueId: 'venue-1',
          seatId: 'seat-1',
          startAt: 'invalid-date',
          endAt: 'invalid-date',
        }),
      })

      const response = await POST(mockRequest)
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Invalid dates')
    })

    it('returns 400 if group booking missing seatCount', async () => {
      mockRequest = new Request('http://localhost/api/reservations', {
        method: 'POST',
        body: JSON.stringify({
          venueId: 'venue-1',
          tableId: 'table-1',
          startAt: createTestDateString(60),
          endAt: createTestDateString(120),
        }),
      })

      const response = await POST(mockRequest)
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('seatCount is required')
    })

    it('returns 400 with PAST_TIME code if startAt is in the past', async () => {
      mockRequest = new Request('http://localhost/api/reservations', {
        method: 'POST',
        body: JSON.stringify({
          venueId: 'venue-1',
          seatId: 'seat-1',
          startAt: createPastDateString(-60), // 1 hour ago
          endAt: createTestDateString(60),
        }),
      })

      const response = await POST(mockRequest)
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.code).toBe('PAST_TIME')
      expect(data.error).toContain('in the past')
    })

    it('allows booking if startAt is exactly now', async () => {
      const venue = createTestVenue({ id: 'venue-1' })
      const table = createTestTable({ id: 'table-1', venueId: venue.id })
      const seat = createTestSeat({ id: 'seat-1', tableId: table.id })

      vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue({
        ...venue,
        venueHours: [],
        openingHoursJson: null,
      })
      vi.mocked(mockPrisma.seat.findMany).mockResolvedValue([
        {
          ...seat,
          table: {
            ...table,
            venue,
            venueId: venue.id,
          },
        },
      ])
      vi.mocked(mockPrisma.reservation.findFirst).mockResolvedValue(null)
      vi.mocked(mockPrisma.reservation.create).mockResolvedValue({
        id: 'reservation-1',
        venueId: venue.id,
        userId: 'test-user-id',
        seatId: seat.id,
        tableId: table.id,
        seatCount: 1,
        startAt: new Date(),
        endAt: createTestDateString(60),
        status: 'active',
      })

      // Use current time (0 offset) for startAt
      mockRequest = new Request('http://localhost/api/reservations', {
        method: 'POST',
        body: JSON.stringify({
          venueId: 'venue-1',
          seatId: 'seat-1',
          startAt: createTestDateString(0), // Now
          endAt: createTestDateString(60),
        }),
      })

      const response = await POST(mockRequest)
      // Should succeed (201) or at least not return PAST_TIME error
      expect(response.status).not.toBe(400)
      if (response.status === 400) {
        const data = await response.json()
        expect(data.code).not.toBe('PAST_TIME')
      }
    })

    it('allows booking if startAt is in the future', async () => {
      const venue = createTestVenue({ id: 'venue-1' })
      const table = createTestTable({ id: 'table-1', venueId: venue.id })
      const seat = createTestSeat({ id: 'seat-1', tableId: table.id })

      vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue({
        ...venue,
        venueHours: [],
        openingHoursJson: null,
      })
      vi.mocked(mockPrisma.seat.findMany).mockResolvedValue([
        {
          ...seat,
          table: {
            ...table,
            venue,
            venueId: venue.id,
          },
        },
      ])
      vi.mocked(mockPrisma.reservation.findFirst).mockResolvedValue(null)
      vi.mocked(mockPrisma.reservation.create).mockResolvedValue({
        id: 'reservation-1',
        venueId: venue.id,
        userId: 'test-user-id',
        seatId: seat.id,
        tableId: table.id,
        seatCount: 1,
        startAt: createTestDateString(60),
        endAt: createTestDateString(120),
        status: 'active',
      })

      mockRequest = new Request('http://localhost/api/reservations', {
        method: 'POST',
        body: JSON.stringify({
          venueId: 'venue-1',
          seatId: 'seat-1',
          startAt: createTestDateString(60), // 1 hour in future
          endAt: createTestDateString(120),
        }),
      })

      const response = await POST(mockRequest)
      // Should succeed (201) or at least not return PAST_TIME error
      expect(response.status).not.toBe(400)
      if (response.status === 400) {
        const data = await response.json()
        expect(data.code).not.toBe('PAST_TIME')
      }
    })
  })

  describe('individual seat booking', () => {
    beforeEach(() => {
      const user = createTestUser({ termsAcceptedAt: new Date() })
      const venue = createTestVenue({
        id: 'venue-1',
        onboardingStatus: 'APPROVED',
        status: 'ACTIVE',
        deletedAt: null,
        owner: { id: 'owner-1', status: 'ACTIVE' },
      })
      const table = createTestTable({ id: 'table-1', venueId: venue.id, isActive: true })
      const seat = createTestSeat({ id: 'seat-1', tableId: table.id, isActive: true })

      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(user)
      vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue({
        ...venue,
        venueHours: [],
        openingHoursJson: null,
      })
      vi.mocked(mockPrisma.seat.findUnique).mockResolvedValue({
        ...seat,
        table: {
          ...table,
          venue,
          venueId: venue.id,
          isActive: true,
        },
      })
      vi.mocked(mockPrisma.seat.findMany).mockResolvedValue([
        {
          ...seat,
          table: {
            ...table,
            venue,
            venueId: venue.id,
          },
        },
      ])
      vi.mocked(mockPrisma.reservation.findFirst).mockResolvedValue(null) // No overlapping
      vi.mocked(mockPrisma.reservation.create).mockResolvedValue({
        id: 'reservation-1',
        venueId: venue.id,
        userId: user.id,
        seatId: seat.id,
        tableId: table.id,
        seatCount: 1,
        startAt: new Date(createTestDateString(60)),
        endAt: new Date(createTestDateString(120)),
        status: 'active',
      })
    })

    it('creates reservation with correct seatCount=1 for single seat', async () => {
      const venue = createTestVenue({
        id: 'venue-1',
        onboardingStatus: 'APPROVED',
        status: 'ACTIVE',
        deletedAt: null,
        owner: { id: 'owner-1', status: 'ACTIVE' },
      })
      const table = createTestTable({ id: 'table-1', venueId: venue.id, isActive: true })
      const seat = createTestSeat({ id: 'seat-1', tableId: table.id, isActive: true })
      
      vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue({
        ...venue,
        venueHours: [],
        openingHoursJson: null,
      })
      vi.mocked(mockPrisma.seat.findUnique).mockResolvedValue({
        ...seat,
        table: { ...table, venue, venueId: venue.id, isActive: true },
      })
      vi.mocked(mockPrisma.reservation.findFirst).mockResolvedValue(null)
      
      mockRequest = new Request('http://localhost/api/reservations', {
        method: 'POST',
        body: JSON.stringify({
          venueId: 'venue-1',
          seatId: 'seat-1',
          startAt: createTestDateString(60),
          endAt: createTestDateString(120),
        }),
      })

      const response = await POST(mockRequest)
      expect(response.status).toBe(201)
      
      // Verify seatCount was set to 1
      expect(vi.mocked(mockPrisma.reservation.create)).toHaveBeenCalled()
      const createCall = vi.mocked(mockPrisma.reservation.create).mock.calls[0][0]
      expect(createCall.data.seatCount).toBe(1)
    })

    it('creates reservation with correct seatCount for multiple seats', async () => {
      const venue = createTestVenue({
        id: 'venue-1',
        onboardingStatus: 'APPROVED',
        status: 'ACTIVE',
        deletedAt: null,
        owner: { id: 'owner-1', status: 'ACTIVE' },
      })
      const table = createTestTable({ id: 'table-1', venueId: venue.id, isActive: true })
      
      vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue({
        ...venue,
        venueHours: [],
        openingHoursJson: null,
      })
      vi.mocked(mockPrisma.seat.findMany).mockResolvedValue([
        {
          ...createTestSeat({ id: 'seat-1', tableId: table.id, isActive: true }),
          table: { ...table, venue, venueId: venue.id },
        },
        {
          ...createTestSeat({ id: 'seat-2', tableId: table.id, isActive: true }),
          table: { ...table, venue, venueId: venue.id },
        },
        {
          ...createTestSeat({ id: 'seat-3', tableId: table.id, isActive: true }),
          table: { ...table, venue, venueId: venue.id },
        },
      ])
      vi.mocked(mockPrisma.reservation.findFirst).mockResolvedValue(null)
      vi.mocked(mockPrisma.reservation.create).mockResolvedValue({
        id: 'reservation-1',
        venueId: venue.id,
        userId: 'test-user-id',
        seatId: null,
        tableId: table.id,
        seatCount: 3,
        startAt: new Date(createTestDateString(60)),
        endAt: new Date(createTestDateString(120)),
        status: 'active',
      })

      mockRequest = new Request('http://localhost/api/reservations', {
        method: 'POST',
        body: JSON.stringify({
          venueId: 'venue-1',
          seatIds: ['seat-1', 'seat-2', 'seat-3'],
          startAt: createTestDateString(60),
          endAt: createTestDateString(120),
        }),
      })

      const response = await POST(mockRequest)
      expect(response.status).toBe(201)
      
      const createCall = vi.mocked(mockPrisma.reservation.create).mock.calls[0][0]
      expect(createCall.data.seatCount).toBe(3)
    })

    it('returns 404 if seat does not exist', async () => {
      vi.mocked(mockPrisma.seat.findMany).mockResolvedValue([])

      mockRequest = new Request('http://localhost/api/reservations', {
        method: 'POST',
        body: JSON.stringify({
          venueId: 'venue-1',
          seatId: 'non-existent-seat',
          startAt: createTestDateString(60),
          endAt: createTestDateString(120),
        }),
      })

      const response = await POST(mockRequest)
      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toContain('not found')
    })

    it.skip('returns 409 if seat is already reserved', async () => {
      const venue = createTestVenue({
        id: 'venue-1',
        onboardingStatus: 'APPROVED',
        status: 'ACTIVE',
        deletedAt: null,
        owner: { id: 'owner-1', status: 'ACTIVE' },
      })
      const table = createTestTable({ id: 'table-1', venueId: venue.id, isActive: true })
      const seat = createTestSeat({ id: 'seat-1', tableId: table.id, isActive: true })
      
      vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue({
        ...venue,
        venueHours: [],
        openingHoursJson: null,
      })
      vi.mocked(mockPrisma.seat.findUnique).mockResolvedValue({
        ...seat,
        table: { ...table, venue, venueId: venue.id, isActive: true },
      })
      vi.mocked(mockPrisma.reservation.findFirst).mockResolvedValue({
        id: 'existing-reservation',
      })

      mockRequest = new Request('http://localhost/api/reservations', {
        method: 'POST',
        body: JSON.stringify({
          venueId: 'venue-1',
          seatId: 'seat-1',
          startAt: createTestDateString(60),
          endAt: createTestDateString(120),
        }),
      })

      const response = await POST(mockRequest)
      expect(response.status).toBe(409)
      const data = await response.json()
      expect(data.error).toContain('not available')
    })

    it('calls enqueueNotification once with booking_confirmation on successful create', async () => {
      vi.mocked(enqueueNotification).mockClear()
      mockRequest = new Request('http://localhost/api/reservations', {
        method: 'POST',
        body: JSON.stringify({
          venueId: 'venue-1',
          seatId: 'seat-1',
          startAt: createTestDateString(60),
          endAt: createTestDateString(120),
        }),
      })

      const response = await POST(mockRequest)
      expect(response.status).toBe(201)
      expect(enqueueNotification).toHaveBeenCalledTimes(1)
      expect(enqueueNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'booking_confirmation',
          dedupeKey: expect.stringMatching(/^booking_confirmation:/),
          toEmail: 'test@example.com',
        })
      )
    })

    it('calls enqueueNotification for both booking_confirmation and venue_booking_created when venue has owner email', async () => {
      vi.mocked(enqueueNotification).mockClear()
      const venue = createTestVenue({
        id: 'venue-1',
        name: 'Test Venue',
        ownerId: 'owner-1',
      })
      vi.mocked(mockPrisma.reservation.create).mockResolvedValue({
        id: 'reservation-1',
        venueId: venue.id,
        userId: 'test-user-id',
        seatId: 'seat-1',
        tableId: 'table-1',
        seatCount: 1,
        startAt: new Date(createTestDateString(60)),
        endAt: new Date(createTestDateString(120)),
        status: 'active',
        venue: {
          ...venue,
          owner: { email: 'owner@example.com' },
        },
        table: null,
        seat: null,
      } as any)

      mockRequest = new Request('http://localhost/api/reservations', {
        method: 'POST',
        body: JSON.stringify({
          venueId: 'venue-1',
          seatId: 'seat-1',
          startAt: createTestDateString(60),
          endAt: createTestDateString(120),
        }),
      })

      const response = await POST(mockRequest)
      expect(response.status).toBe(201)
      expect(enqueueNotification).toHaveBeenCalledTimes(2)
      expect(enqueueNotification).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          type: 'booking_confirmation',
          dedupeKey: expect.stringMatching(/^booking_confirmation:/),
          toEmail: 'test@example.com',
        })
      )
      expect(enqueueNotification).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          type: 'venue_booking_created',
          dedupeKey: expect.stringMatching(/^venue_booking_created:/),
          toEmail: 'owner@example.com',
        })
      )
    })
  })

  describe('group table booking', () => {
    beforeEach(() => {
      const user = createTestUser({ termsAcceptedAt: new Date() })
      const venue = createTestVenue({
        id: 'venue-1',
        onboardingStatus: 'APPROVED',
        status: 'ACTIVE',
        deletedAt: null,
        owner: { id: 'owner-1', status: 'ACTIVE' },
      })
      const table = createTestTable({
        id: 'table-1',
        venueId: venue.id,
        seatCount: 4,
        bookingMode: 'group',
        tablePricePerHour: 40,
        isActive: true,
      })

      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(user)
      vi.mocked(mockPrisma.table.findUnique).mockResolvedValue({
        ...table,
        venueId: venue.id,
        venue,
        seats: Array.from({ length: 4 }, (_, i) => createTestSeat({ id: `seat-${i + 1}`, tableId: table.id })),
      })
      vi.mocked(mockPrisma.reservation.findFirst).mockResolvedValue(null) // No overlapping
      vi.mocked(mockPrisma.reservation.create).mockResolvedValue({
        id: 'reservation-1',
        venueId: venue.id,
        userId: user.id,
        seatId: null,
        tableId: table.id,
        seatCount: 4, // Should use table's actual seatCount
        startAt: new Date(createTestDateString(60)),
        endAt: new Date(createTestDateString(120)),
        status: 'active',
      })
    })

    it('uses table actual seatCount for group booking', async () => {
      // This tests the critical bug we fixed
      const tableSeatCount = 4
      const selectorSeatCount = 1 // User might have selector at 1
      const venue = createTestVenue({
        id: 'venue-1',
        onboardingStatus: 'APPROVED',
        status: 'ACTIVE',
        deletedAt: null,
        owner: { id: 'owner-1', status: 'ACTIVE' },
      })
      
      // Ensure venue.findUnique is mocked (it's set in beforeEach, but this test might need it explicitly)
      vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue({
        ...venue,
        venueHours: [],
        openingHoursJson: null,
      })

      mockRequest = new Request('http://localhost/api/reservations', {
        method: 'POST',
        body: JSON.stringify({
          venueId: 'venue-1',
          tableId: 'table-1',
          seatCount: tableSeatCount, // Should be table's actual count, not selector
          startAt: createTestDateString(60),
          endAt: createTestDateString(120),
        }),
      })

      const response = await POST(mockRequest)
      expect(response.status).toBe(201)
      
      // Verify seatCount matches table's actual seatCount
      const createCall = vi.mocked(mockPrisma.reservation.create).mock.calls[0][0]
      expect(createCall.data.seatCount).toBe(tableSeatCount)
      expect(createCall.data.seatCount).not.toBe(selectorSeatCount)
    })

    it('validates seatCount does not exceed table capacity', async () => {
      // Override the table mock to have only 4 seats
      const venue = createTestVenue({
        id: 'venue-1',
        onboardingStatus: 'APPROVED',
        status: 'ACTIVE',
        deletedAt: null,
        owner: { id: 'owner-1', status: 'ACTIVE' },
      })
      const table = createTestTable({
        id: 'table-1',
        venueId: venue.id,
        seatCount: 4,
        bookingMode: 'group',
        isActive: true,
      })
      vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue({
        ...venue,
        venueHours: [],
        openingHoursJson: null,
      })
      vi.mocked(mockPrisma.table.findUnique).mockResolvedValue({
        ...table,
        venueId: venue.id,
        venue: {
          ...venue,
          venueHours: [],
          openingHoursJson: null,
        },
        seats: Array.from({ length: 4 }, (_, i) => createTestSeat({ id: `seat-${i + 1}`, tableId: table.id })),
      })

      mockRequest = new Request('http://localhost/api/reservations', {
        method: 'POST',
        body: JSON.stringify({
          venueId: 'venue-1',
          tableId: 'table-1',
          seatCount: 10, // More than table's 4 seats
          startAt: createTestDateString(60),
          endAt: createTestDateString(120),
        }),
      })

      const response = await POST(mockRequest)
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('only has')
    })

    it('returns 404 if table does not exist', async () => {
      vi.mocked(mockPrisma.table.findUnique).mockResolvedValue(null)

      mockRequest = new Request('http://localhost/api/reservations', {
        method: 'POST',
        body: JSON.stringify({
          venueId: 'venue-1',
          tableId: 'non-existent-table',
          seatCount: 4,
          startAt: createTestDateString(60),
          endAt: createTestDateString(120),
        }),
      })

      const response = await POST(mockRequest)
      expect(response.status).toBe(404)
    })

    it.skip('returns 409 if table is already reserved', async () => {
      const venue = createTestVenue({
        id: 'venue-1',
        onboardingStatus: 'APPROVED',
        status: 'ACTIVE',
        deletedAt: null,
        owner: { id: 'owner-1', status: 'ACTIVE' },
      })
      const table = createTestTable({
        id: 'table-1',
        venueId: venue.id,
        seatCount: 4,
        bookingMode: 'group',
        isActive: true,
      })
      
      vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue({
        ...venue,
        venueHours: [],
        openingHoursJson: null,
      })
      vi.mocked(mockPrisma.table.findUnique).mockResolvedValue({
        ...table,
        venueId: venue.id,
        venue: {
          ...venue,
          venueHours: [],
          openingHoursJson: null,
        },
        seats: Array.from({ length: 4 }, (_, i) => createTestSeat({ id: `seat-${i + 1}`, tableId: table.id })),
      })
      vi.mocked(mockPrisma.reservation.findFirst).mockResolvedValue({
        id: 'existing-reservation',
      })

      mockRequest = new Request('http://localhost/api/reservations', {
        method: 'POST',
        body: JSON.stringify({
          venueId: 'venue-1',
          tableId: 'table-1',
          seatCount: 4,
          startAt: createTestDateString(60),
          endAt: createTestDateString(120),
        }),
      })

      const response = await POST(mockRequest)
      expect(response.status).toBe(409)
      const data = await response.json()
      expect(data.error).toContain('not available')
    })
  })

  describe('user validation', () => {
    it('returns 401 if user does not exist in database', async () => {
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(null)

      mockRequest = new Request('http://localhost/api/reservations', {
        method: 'POST',
        body: JSON.stringify({
          venueId: 'venue-1',
          seatId: 'seat-1',
          startAt: createTestDateString(60),
          endAt: createTestDateString(120),
        }),
      })

      const response = await POST(mockRequest)
      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toContain('not found')
    })
  })
})
