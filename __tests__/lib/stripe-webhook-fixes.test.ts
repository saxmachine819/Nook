import { describe, it, expect, beforeEach, vi } from 'vitest'
import { buildBookingContext } from '@/lib/booking'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    venue: {
      findUnique: vi.fn(),
    },
    seat: {
      findMany: vi.fn(),
    },
    reservation: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/hours', () => ({
  getCanonicalVenueHours: vi.fn().mockResolvedValue({ weeklyHours: [] }),
  isReservationWithinCanonicalHours: vi.fn().mockReturnValue({ isValid: true }),
}))

vi.mock('@/lib/booking-guard', () => ({
  canBookVenue: vi.fn().mockResolvedValue(true),
}))

describe('Stripe Fixes - Booking Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should allow booking if a pending reservation has expired', async () => {
    const now = new Date()
    const past = new Date(now.getTime() - 1000)

    vi.mocked(prisma.venue.findUnique).mockResolvedValue({
      id: 'venue-1',
      onboardingStatus: 'APPROVED',
      venueHours: [],
    } as any)

    vi.mocked(prisma.seat.findMany).mockResolvedValue([
      {
        id: 'seat-1',
        tableId: 'table-1',
        isActive: true,
        table: { id: 'table-1', venueId: 'venue-1', isActive: true },
      },
    ] as any)

    // Mock an overlapping pending reservation that is EXPIRED
    vi.mocked(prisma.reservation.findFirst).mockResolvedValue(null)

    const payload = {
      venueId: 'venue-1',
      seatId: 'seat-1',
      startAt: new Date(now.getTime() + 3600000).toISOString(),
      endAt: new Date(now.getTime() + 7200000).toISOString(),
    }

    const context = await buildBookingContext(payload, 'user-1')
    expect(context).toBeDefined()
    expect(prisma.reservation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ status: { notIn: ['cancelled', 'pending'] } }),
            expect.objectContaining({ status: 'pending' }),
          ]),
        }),
      })
    )
  })

  it('should block booking if a pending reservation is still valid', async () => {
    const now = new Date()

    vi.mocked(prisma.venue.findUnique).mockResolvedValue({
      id: 'venue-1',
      onboardingStatus: 'APPROVED',
      venueHours: [],
    } as any)

    vi.mocked(prisma.seat.findMany).mockResolvedValue([
      {
        id: 'seat-1',
        tableId: 'table-1',
        isActive: true,
        table: { id: 'table-1', venueId: 'venue-1', isActive: true },
      },
    ] as any)

    // Mock an overlapping reservation found
    vi.mocked(prisma.reservation.findFirst).mockResolvedValue({ id: 'res-1' } as any)

    const payload = {
      venueId: 'venue-1',
      seatId: 'seat-1',
      startAt: new Date(now.getTime() + 3600000).toISOString(),
      endAt: new Date(now.getTime() + 7200000).toISOString(),
    }

    await expect(buildBookingContext(payload, 'user-1')).rejects.toThrow(
      'One or more seats are not available for that time.'
    )
  })
})
