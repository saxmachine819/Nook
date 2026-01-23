import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  isReservationActive,
  getReservationStatus,
  groupReservationsByTime,
  formatTimeRange,
  formatDate,
  isToday,
  getSeatLabel,
  getReservationSeatInfo,
  getBookerDisplay,
  isSeatBlocked,
  type Reservation,
  type SeatBlock,
} from '@/lib/venue-ops'

describe('venue-ops utility functions', () => {
  const now = new Date('2024-01-22T14:00:00Z')

  describe('isReservationActive', () => {
    it('returns true for currently active reservation', () => {
      const reservation: Reservation = {
        id: '1',
        startAt: new Date('2024-01-22T13:00:00Z'),
        endAt: new Date('2024-01-22T15:00:00Z'),
        status: 'active',
        seatCount: 1,
      }
      expect(isReservationActive(reservation, now)).toBe(true)
    })

    it('returns false for future reservation', () => {
      const reservation: Reservation = {
        id: '1',
        startAt: new Date('2024-01-22T15:00:00Z'),
        endAt: new Date('2024-01-22T16:00:00Z'),
        status: 'active',
        seatCount: 1,
      }
      expect(isReservationActive(reservation, now)).toBe(false)
    })

    it('returns false for past reservation', () => {
      const reservation: Reservation = {
        id: '1',
        startAt: new Date('2024-01-22T12:00:00Z'),
        endAt: new Date('2024-01-22T13:00:00Z'),
        status: 'active',
        seatCount: 1,
      }
      expect(isReservationActive(reservation, now)).toBe(false)
    })

    it('returns false for cancelled reservation even if time matches', () => {
      const reservation: Reservation = {
        id: '1',
        startAt: new Date('2024-01-22T13:00:00Z'),
        endAt: new Date('2024-01-22T15:00:00Z'),
        status: 'cancelled',
        seatCount: 1,
      }
      expect(isReservationActive(reservation, now)).toBe(false)
    })

    it('handles string dates', () => {
      const reservation: Reservation = {
        id: '1',
        startAt: '2024-01-22T13:00:00Z',
        endAt: '2024-01-22T15:00:00Z',
        status: 'active',
        seatCount: 1,
      }
      expect(isReservationActive(reservation, now)).toBe(true)
    })
  })

  describe('getReservationStatus', () => {
    it('returns "now" for active reservation', () => {
      const reservation: Reservation = {
        id: '1',
        startAt: new Date('2024-01-22T13:00:00Z'),
        endAt: new Date('2024-01-22T15:00:00Z'),
        status: 'active',
        seatCount: 1,
      }
      expect(getReservationStatus(reservation, now)).toBe('now')
    })

    it('returns "upcoming" for future reservation', () => {
      const reservation: Reservation = {
        id: '1',
        startAt: new Date('2024-01-22T15:00:00Z'),
        endAt: new Date('2024-01-22T16:00:00Z'),
        status: 'active',
        seatCount: 1,
      }
      expect(getReservationStatus(reservation, now)).toBe('upcoming')
    })

    it('returns "past" for past reservation', () => {
      const reservation: Reservation = {
        id: '1',
        startAt: new Date('2024-01-22T12:00:00Z'),
        endAt: new Date('2024-01-22T13:00:00Z'),
        status: 'active',
        seatCount: 1,
      }
      expect(getReservationStatus(reservation, now)).toBe('past')
    })

    it('returns "cancelled" for cancelled reservation regardless of time', () => {
      const reservation: Reservation = {
        id: '1',
        startAt: new Date('2024-01-22T13:00:00Z'),
        endAt: new Date('2024-01-22T15:00:00Z'),
        status: 'cancelled',
        seatCount: 1,
      }
      expect(getReservationStatus(reservation, now)).toBe('cancelled')
    })
  })

  describe('formatTimeRange', () => {
    it('formats time range correctly', () => {
      const start = new Date('2024-01-22T14:00:00Z')
      const end = new Date('2024-01-22T16:00:00Z')
      const result = formatTimeRange(start, end)
      expect(result).toMatch(/\d{1,2}:\d{2} [AP]M – \d{1,2}:\d{2} [AP]M/)
    })

    it('handles string dates', () => {
      const result = formatTimeRange('2024-01-22T14:00:00Z', '2024-01-22T16:00:00Z')
      expect(result).toMatch(/\d{1,2}:\d{2} [AP]M – \d{1,2}:\d{2} [AP]M/)
    })
  })

  describe('formatDate', () => {
    it('formats date correctly', () => {
      const date = new Date('2024-01-22T14:00:00Z')
      const result = formatDate(date)
      expect(result).toMatch(/Mon, Jan 22|Tue, Jan 22|Wed, Jan 22|Thu, Jan 22|Fri, Jan 22|Sat, Jan 22|Sun, Jan 22/)
    })

    it('handles string dates', () => {
      const result = formatDate('2024-01-22T14:00:00Z')
      expect(result).toMatch(/Mon, Jan 22|Tue, Jan 22|Wed, Jan 22|Thu, Jan 22|Fri, Jan 22|Sat, Jan 22|Sun, Jan 22/)
    })
  })

  describe('isToday', () => {
    it('returns true for today', () => {
      const today = new Date()
      expect(isToday(today)).toBe(true)
    })

    it('returns false for yesterday', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      expect(isToday(yesterday)).toBe(false)
    })

    it('returns false for tomorrow', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      expect(isToday(tomorrow)).toBe(false)
    })

    it('handles string dates', () => {
      const today = new Date().toISOString()
      expect(isToday(today)).toBe(true)
    })
  })

  describe('getSeatLabel', () => {
    it('returns label if available', () => {
      const seat = { label: 'Window Seat', position: 1 }
      expect(getSeatLabel(seat)).toBe('Window Seat')
    })

    it('returns "Seat {position}" if no label but position exists', () => {
      const seat = { label: null, position: 5 }
      expect(getSeatLabel(seat)).toBe('Seat 5')
    })

    it('returns "Seat" if no label or position', () => {
      const seat = { label: null, position: null }
      expect(getSeatLabel(seat)).toBe('Seat')
    })

    it('returns "Unknown seat" for null/undefined', () => {
      expect(getSeatLabel(null)).toBe('Unknown seat')
      expect(getSeatLabel(undefined)).toBe('Unknown seat')
    })
  })

  describe('getReservationSeatInfo', () => {
    it('returns seat label and table name for individual seat booking', () => {
      const reservation: Reservation = {
        id: '1',
        startAt: new Date(),
        endAt: new Date(),
        status: 'active',
        seatId: 'seat-1',
        seatCount: 1,
        seat: {
          label: 'Seat 1',
          table: { name: 'Table A' },
        },
      }
      expect(getReservationSeatInfo(reservation)).toBe('Seat 1 at Table A')
    })

    it('returns seat count and table name for group booking', () => {
      const reservation: Reservation = {
        id: '1',
        startAt: new Date(),
        endAt: new Date(),
        status: 'active',
        tableId: 'table-1',
        seatCount: 4,
        table: { name: 'Table A' },
      }
      expect(getReservationSeatInfo(reservation)).toBe('4 seats at Table A')
    })

    it('returns seat count only if no table info', () => {
      const reservation: Reservation = {
        id: '1',
        startAt: new Date(),
        endAt: new Date(),
        status: 'active',
        seatCount: 3,
      }
      expect(getReservationSeatInfo(reservation)).toBe('3 seats')
    })

    it('handles singular seat count', () => {
      const reservation: Reservation = {
        id: '1',
        startAt: new Date(),
        endAt: new Date(),
        status: 'active',
        seatCount: 1,
      }
      // The function uses "seat" (singular) when count=1, "seats" (plural) when count > 1
      const result = getReservationSeatInfo(reservation)
      expect(result).toBe('1 seat')
    })
  })

  describe('getBookerDisplay', () => {
    it('returns email if available', () => {
      const reservation: Reservation = {
        id: '1',
        startAt: new Date(),
        endAt: new Date(),
        status: 'active',
        seatCount: 1,
        user: { email: 'user@example.com' },
      }
      expect(getBookerDisplay(reservation)).toBe('user@example.com')
    })

    it('returns "Guest {userId}" if no email but userId exists', () => {
      const reservation: Reservation = {
        id: '1',
        startAt: new Date(),
        endAt: new Date(),
        status: 'active',
        seatCount: 1,
        userId: 'abc123def456',
      }
      expect(getBookerDisplay(reservation)).toBe('Guest abc123de')
    })

    it('returns "Guest" if no user info', () => {
      const reservation: Reservation = {
        id: '1',
        startAt: new Date(),
        endAt: new Date(),
        status: 'active',
        seatCount: 1,
      }
      expect(getBookerDisplay(reservation)).toBe('Guest')
    })
  })

  describe('isSeatBlocked', () => {
    it('returns true if seat is blocked', () => {
      const blocks: SeatBlock[] = [
        {
          id: '1',
          seatId: 'seat-1',
          startAt: new Date('2024-01-22T13:00:00Z'),
          endAt: new Date('2024-01-22T15:00:00Z'),
        },
      ]
      expect(isSeatBlocked('seat-1', blocks, now)).toBe(true)
    })

    it('returns false if seat is not blocked', () => {
      const blocks: SeatBlock[] = [
        {
          id: '1',
          seatId: 'seat-2',
          startAt: new Date('2024-01-22T13:00:00Z'),
          endAt: new Date('2024-01-22T15:00:00Z'),
        },
      ]
      expect(isSeatBlocked('seat-1', blocks, now)).toBe(false)
    })

    it('returns false if block is in the past', () => {
      const blocks: SeatBlock[] = [
        {
          id: '1',
          seatId: 'seat-1',
          startAt: new Date('2024-01-22T12:00:00Z'),
          endAt: new Date('2024-01-22T13:00:00Z'),
        },
      ]
      expect(isSeatBlocked('seat-1', blocks, now)).toBe(false)
    })

    it('returns false if block is in the future', () => {
      const blocks: SeatBlock[] = [
        {
          id: '1',
          seatId: 'seat-1',
          startAt: new Date('2024-01-22T15:00:00Z'),
          endAt: new Date('2024-01-22T16:00:00Z'),
        },
      ]
      expect(isSeatBlocked('seat-1', blocks, now)).toBe(false)
    })
  })

  describe('groupReservationsByTime', () => {
    it('groups reservations into now, today, and next', () => {
      const now = new Date('2024-01-22T14:00:00Z')
      const reservations: Reservation[] = [
        {
          id: '1',
          startAt: new Date('2024-01-22T13:00:00Z'),
          endAt: new Date('2024-01-22T15:00:00Z'),
          status: 'active',
          seatCount: 1,
        },
        {
          id: '2',
          startAt: new Date('2024-01-22T16:00:00Z'),
          endAt: new Date('2024-01-22T17:00:00Z'),
          status: 'active',
          seatCount: 1,
        },
        {
          id: '3',
          startAt: new Date('2024-01-25T10:00:00Z'),
          endAt: new Date('2024-01-25T11:00:00Z'),
          status: 'active',
          seatCount: 1,
        },
      ]

      const result = groupReservationsByTime(reservations, now)
      expect(result.now).toHaveLength(1)
      expect(result.now[0].id).toBe('1')
      expect(result.today).toHaveLength(1)
      expect(result.today[0].id).toBe('2')
      expect(result.next).toHaveLength(1)
      expect(result.next[0].id).toBe('3')
    })

    it('excludes cancelled reservations from now group', () => {
      const now = new Date('2024-01-22T14:00:00Z')
      const reservations: Reservation[] = [
        {
          id: '1',
          startAt: new Date('2024-01-22T13:00:00Z'),
          endAt: new Date('2024-01-22T15:00:00Z'),
          status: 'cancelled',
          seatCount: 1,
        },
      ]

      const result = groupReservationsByTime(reservations, now)
      expect(result.now).toHaveLength(0)
    })
  })
})
