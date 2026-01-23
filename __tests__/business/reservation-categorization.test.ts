import { describe, it, expect } from 'vitest'

/**
 * Test reservation categorization logic
 * This tests the logic used in VenueOpsConsoleClient for categorizing reservations
 */

interface Reservation {
  id: string
  startAt: Date
  endAt: Date
  status: string
  seatCount: number
}

function categorizeReservations(
  reservations: Reservation[],
  now: Date
): { upcoming: Reservation[]; past: Reservation[]; cancelled: Reservation[] } {
  const upcoming: Reservation[] = []
  const past: Reservation[] = []
  const cancelled: Reservation[] = []

  for (const reservation of reservations) {
    if (reservation.status === 'cancelled') {
      cancelled.push(reservation)
    } else {
      if (reservation.endAt >= now) {
        upcoming.push(reservation)
      } else {
        past.push(reservation)
      }
    }
  }

  // Sort upcoming by startAt ascending (nearest first)
  upcoming.sort((a, b) => a.startAt.getTime() - b.startAt.getTime())

  // Sort past by startAt descending (most recent first)
  past.sort((a, b) => b.startAt.getTime() - a.startAt.getTime())

  // Sort cancelled by startAt descending (most recent first)
  cancelled.sort((a, b) => b.startAt.getTime() - a.startAt.getTime())

  return { upcoming, past, cancelled }
}

describe('reservation categorization', () => {
  const now = new Date('2024-01-22T14:00:00Z')

  describe('upcoming reservations', () => {
    it('categorizes reservation as upcoming if endAt >= now and status is active', () => {
      const reservation: Reservation = {
        id: '1',
        startAt: new Date('2024-01-22T15:00:00Z'),
        endAt: new Date('2024-01-22T16:00:00Z'),
        status: 'active',
        seatCount: 1,
      }

      const { upcoming, past, cancelled } = categorizeReservations([reservation], now)
      expect(upcoming).toHaveLength(1)
      expect(upcoming[0].id).toBe('1')
      expect(past).toHaveLength(0)
      expect(cancelled).toHaveLength(0)
    })

    it('categorizes currently active reservation as upcoming', () => {
      const reservation: Reservation = {
        id: '1',
        startAt: new Date('2024-01-22T13:00:00Z'),
        endAt: new Date('2024-01-22T15:00:00Z'),
        status: 'active',
        seatCount: 1,
      }

      const { upcoming } = categorizeReservations([reservation], now)
      expect(upcoming).toHaveLength(1)
    })

    it('sorts upcoming reservations by startAt ascending', () => {
      const reservations: Reservation[] = [
        {
          id: '2',
          startAt: new Date('2024-01-22T16:00:00Z'),
          endAt: new Date('2024-01-22T17:00:00Z'),
          status: 'active',
          seatCount: 1,
        },
        {
          id: '1',
          startAt: new Date('2024-01-22T15:00:00Z'),
          endAt: new Date('2024-01-22T16:00:00Z'),
          status: 'active',
          seatCount: 1,
        },
      ]

      const { upcoming } = categorizeReservations(reservations, now)
      expect(upcoming).toHaveLength(2)
      expect(upcoming[0].id).toBe('1')
      expect(upcoming[1].id).toBe('2')
    })
  })

  describe('past reservations', () => {
    it('categorizes reservation as past if endAt < now and status is active', () => {
      const reservation: Reservation = {
        id: '1',
        startAt: new Date('2024-01-22T12:00:00Z'),
        endAt: new Date('2024-01-22T13:00:00Z'),
        status: 'active',
        seatCount: 1,
      }

      const { upcoming, past, cancelled } = categorizeReservations([reservation], now)
      expect(past).toHaveLength(1)
      expect(past[0].id).toBe('1')
      expect(upcoming).toHaveLength(0)
      expect(cancelled).toHaveLength(0)
    })

    it('sorts past reservations by startAt descending (most recent first)', () => {
      const reservations: Reservation[] = [
        {
          id: '1',
          startAt: new Date('2024-01-22T10:00:00Z'),
          endAt: new Date('2024-01-22T11:00:00Z'),
          status: 'active',
          seatCount: 1,
        },
        {
          id: '2',
          startAt: new Date('2024-01-22T12:00:00Z'),
          endAt: new Date('2024-01-22T13:00:00Z'),
          status: 'active',
          seatCount: 1,
        },
      ]

      const { past } = categorizeReservations(reservations, now)
      expect(past).toHaveLength(2)
      expect(past[0].id).toBe('2') // Most recent first
      expect(past[1].id).toBe('1')
    })
  })

  describe('cancelled reservations', () => {
    it('categorizes reservation as cancelled if status is cancelled, regardless of date', () => {
      const futureCancelled: Reservation = {
        id: '1',
        startAt: new Date('2024-01-22T15:00:00Z'),
        endAt: new Date('2024-01-22T16:00:00Z'),
        status: 'cancelled',
        seatCount: 1,
      }

      const pastCancelled: Reservation = {
        id: '2',
        startAt: new Date('2024-01-22T12:00:00Z'),
        endAt: new Date('2024-01-22T13:00:00Z'),
        status: 'cancelled',
        seatCount: 1,
      }

      const { cancelled } = categorizeReservations([futureCancelled, pastCancelled], now)
      expect(cancelled).toHaveLength(2)
    })

    it('sorts cancelled reservations by startAt descending (most recent first)', () => {
      const reservations: Reservation[] = [
        {
          id: '1',
          startAt: new Date('2024-01-22T10:00:00Z'),
          endAt: new Date('2024-01-22T11:00:00Z'),
          status: 'cancelled',
          seatCount: 1,
        },
        {
          id: '2',
          startAt: new Date('2024-01-22T12:00:00Z'),
          endAt: new Date('2024-01-22T13:00:00Z'),
          status: 'cancelled',
          seatCount: 1,
        },
      ]

      const { cancelled } = categorizeReservations(reservations, now)
      expect(cancelled).toHaveLength(2)
      expect(cancelled[0].id).toBe('2') // Most recent first
      expect(cancelled[1].id).toBe('1')
    })
  })

  describe('edge cases', () => {
    it('handles reservation ending exactly at now as upcoming', () => {
      const reservation: Reservation = {
        id: '1',
        startAt: new Date('2024-01-22T13:00:00Z'),
        endAt: now, // Exactly now
        status: 'active',
        seatCount: 1,
      }

      const { upcoming } = categorizeReservations([reservation], now)
      expect(upcoming).toHaveLength(1)
    })

    it('handles reservation starting exactly at now as upcoming', () => {
      const reservation: Reservation = {
        id: '1',
        startAt: now, // Exactly now
        endAt: new Date('2024-01-22T15:00:00Z'),
        status: 'active',
        seatCount: 1,
      }

      const { upcoming } = categorizeReservations([reservation], now)
      expect(upcoming).toHaveLength(1)
    })

    it('handles empty reservations array', () => {
      const { upcoming, past, cancelled } = categorizeReservations([], now)
      expect(upcoming).toHaveLength(0)
      expect(past).toHaveLength(0)
      expect(cancelled).toHaveLength(0)
    })
  })
})
