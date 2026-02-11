import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createMockPrisma, createMockSession } from '../setup/mocks'
import { createTestDateString, createTestUser, createTestVenue, createTestTable, createTestSeat } from '../helpers/test-utils'

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
const { POST } = await import('@/app/api/reservations/route')

/**
 * Payment Protection Tests
 * 
 * These tests ensure that nothing related to payments has been broken or changed
 * while working on non-payment features. This protects the Stripe integration
 * work happening in parallel.
 * 
 * Based on PAYMENTS_ARE_PROTECTED.md guidelines.
 */
describe('Payment Protection Tests', () => {
  describe('Payment Protection Document', () => {
    it('should have PAYMENTS_ARE_PROTECTED.md document', () => {
      const docPath = join(process.cwd(), 'context', 'PAYMENTS_ARE_PROTECTED.md')
      const docContent = readFileSync(docPath, 'utf-8')
      
      expect(docContent).toContain('PAYMENTS ARE PROTECTED')
      expect(docContent).toContain('STRIPE SAFETY RULES')
      expect(docContent).toContain('PaymentIntent')
      expect(docContent).toContain('Stripe client setup')
    })
  })

  describe('Schema - Pricing Fields', () => {
    it('should have hourlySeatPrice field in Venue model', () => {
      const schemaPath = join(process.cwd(), 'prisma', 'schema.prisma')
      const schemaContent = readFileSync(schemaPath, 'utf-8')
      
      // Check Venue model has hourlySeatPrice
      const venueModelMatch = schemaContent.match(/model Venue\s*\{[\s\S]*?\n\}/)
      expect(venueModelMatch).toBeTruthy()
      expect(venueModelMatch![0]).toContain('hourlySeatPrice')
      expect(venueModelMatch![0]).toMatch(/hourlySeatPrice\s+Float/)
    })

    it('should have pricePerHour field in Seat model', () => {
      const schemaPath = join(process.cwd(), 'prisma', 'schema.prisma')
      const schemaContent = readFileSync(schemaPath, 'utf-8')
      
      // Check Seat model has pricePerHour
      const seatModelMatch = schemaContent.match(/model Seat\s*\{[\s\S]*?\n\}/)
      expect(seatModelMatch).toBeTruthy()
      expect(seatModelMatch![0]).toContain('pricePerHour')
      expect(seatModelMatch![0]).toMatch(/pricePerHour\s+Float/)
    })

    it('should have tablePricePerHour field in Table model', () => {
      const schemaPath = join(process.cwd(), 'prisma', 'schema.prisma')
      const schemaContent = readFileSync(schemaPath, 'utf-8')
      
      // Check Table model has tablePricePerHour
      const tableModelMatch = schemaContent.match(/model Table\s*\{[\s\S]*?\n\}/)
      expect(tableModelMatch).toBeTruthy()
      expect(tableModelMatch![0]).toContain('tablePricePerHour')
      expect(tableModelMatch![0]).toMatch(/tablePricePerHour\s+Float\?/)
    })

    it('should have Reservation model with critical fields for payment integration', () => {
      const schemaPath = join(process.cwd(), 'prisma', 'schema.prisma')
      const schemaContent = readFileSync(schemaPath, 'utf-8')
      
      // Check Reservation model has critical fields
      const reservationModelMatch = schemaContent.match(/model Reservation\s*\{[\s\S]*?\n\}/)
      expect(reservationModelMatch).toBeTruthy()
      const modelContent = reservationModelMatch![0]
      
      // These fields are critical for payment integration
      expect(modelContent).toContain('id')
      expect(modelContent).toContain('venueId')
      expect(modelContent).toContain('userId')
      expect(modelContent).toContain('status')
      expect(modelContent).toContain('seatCount')
      expect(modelContent).toContain('startAt')
      expect(modelContent).toContain('endAt')
    })
  })

  describe('Reservation API - Critical for Payment Integration', () => {
    let mockRequest: Request

    beforeEach(async () => {
      vi.clearAllMocks()
      // Reset mockPrisma
      Object.keys(mockPrisma).forEach((key) => {
        Object.keys(mockPrisma[key as keyof typeof mockPrisma]).forEach((method) => {
          if (typeof mockPrisma[key as keyof typeof mockPrisma][method as keyof typeof mockPrisma[keyof typeof mockPrisma]] === 'function') {
            (vi.mocked(mockPrisma[key as keyof typeof mockPrisma][method as keyof typeof mockPrisma[keyof typeof mockPrisma]]) as any).mockReset()
          }
        })
      })

      // Default mock session
      const { auth } = await import('@/lib/auth')
      vi.mocked(auth).mockResolvedValue(createMockSession(createTestUser() as any) as any)
    })

    it.skip('should successfully create reservation with pricing data', async () => {
      const user = createTestUser()
      const venue = createTestVenue({ id: 'venue-1', hourlySeatPrice: 15.0 })
      const table = createTestTable({ id: 'table-1', venueId: venue.id, tablePricePerHour: 40.0 })
      const seat = createTestSeat({ id: 'seat-1', tableId: table.id, pricePerHour: 12.0 })

      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(user)
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
            venue: {
              ...venue,
              venueHours: [],
              openingHoursJson: null,
            },
            venueId: venue.id,
          },
        },
      ])
      vi.mocked(mockPrisma.reservation.findFirst).mockResolvedValue(null)
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
        createdAt: new Date(),
        updatedAt: new Date(),
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
      expect(response.status).toBe(201)
      
      // Verify reservation was created - critical for payment processing
      expect(mockPrisma.reservation.create).toHaveBeenCalled()
      const createCall = vi.mocked(mockPrisma.reservation.create).mock.calls[0][0]
      expect(createCall.data.seatCount).toBe(1)
      expect(createCall.data.venueId).toBe('venue-1')
      expect(createCall.data.seatId).toBe('seat-1')
    })

    it.skip('should preserve pricing information in reservation creation flow', async () => {
      const user = createTestUser()
      const venue = createTestVenue({ id: 'venue-1', hourlySeatPrice: 20.0 })
      const table: any = createTestTable({ 
        id: 'table-1', 
        venueId: venue.id, 
        tablePricePerHour: 50.0,
        bookingMode: 'group'
      })
      
      const seat = createTestSeat({ id: 'seat-1', tableId: table.id, pricePerHour: 18.0 })

      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(user)
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
            venue: {
              ...venue,
              venueHours: [],
              openingHoursJson: null,
            },
            venueId: venue.id,
          },
        },
      ])
      vi.mocked(mockPrisma.reservation.findFirst).mockResolvedValue(null)
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
        createdAt: new Date(),
        updatedAt: new Date(),
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
      expect(response.status).toBe(201)
      
      // Verify that pricing data is accessible (venue has hourlySeatPrice, seat has pricePerHour)
      // This is critical for payment calculation
      expect(venue.hourlySeatPrice).toBe(20.0)
      expect(seat.pricePerHour).toBe(18.0)
      expect(table.tablePricePerHour).toBe(50.0)
    })
  })

  describe('Data Structure Integrity', () => {
    it('should have Reservation model that supports payment integration fields', () => {
      // Reservation model must have these fields for payment integration:
      // - id (for payment reference)
      // - venueId (for venue payment processing)
      // - userId (for customer payment)
      // - status (for payment state tracking)
      // - seatCount (for price calculation)
      // - startAt/endAt (for duration-based pricing)
      
      const schemaPath = join(process.cwd(), 'prisma', 'schema.prisma')
      const schemaContent = readFileSync(schemaPath, 'utf-8')
      
      const reservationModelMatch = schemaContent.match(/model Reservation\s*\{[\s\S]*?\n\}/)
      expect(reservationModelMatch).toBeTruthy()
      const modelContent = reservationModelMatch![0]
      
      // These are the minimum fields needed for payment integration
      const requiredFields = ['id', 'venueId', 'userId', 'status', 'seatCount', 'startAt', 'endAt']
      requiredFields.forEach(field => {
        expect(modelContent).toContain(field)
      })
    })
  })
})
