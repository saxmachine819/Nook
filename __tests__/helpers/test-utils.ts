/**
 * Test utilities and factory functions for creating test data
 */

export function createTestDate(offsetMinutes = 0): Date {
  const date = new Date()
  date.setMinutes(date.getMinutes() + offsetMinutes)
  return date
}

/**
 * Returns a Date that is on a 15-minute boundary (:00, :15, :30, :45) with seconds and ms zero.
 * Uses "now" + offsetMinutes, then rounds down to the previous 15-min boundary (or up if you need future).
 */
export function createTestDateOn15Min(offsetMinutes = 0): Date {
  const date = new Date()
  date.setMinutes(date.getMinutes() + offsetMinutes)
  date.setSeconds(0, 0)
  const min = date.getMinutes()
  const rounded = Math.floor(min / 15) * 15
  date.setMinutes(rounded, 0, 0)
  return date
}

export function createTestDateString(offsetMinutes = 0): string {
  return createTestDate(offsetMinutes).toISOString()
}

/** ISO string for a time on a 15-minute boundary (for reservation API which requires :00, :15, :30, :45). */
export function createTestDateStringOn15Min(offsetMinutes = 0): string {
  return createTestDateOn15Min(offsetMinutes).toISOString()
}

/**
 * Like createTestDateStringOn15Min but rounds UP to the next 15-min boundary.
 * Use when startAt must not be in the past (e.g. "exactly now" tests).
 */
export function createTestDateStringOn15MinRoundUp(offsetMinutes = 0): string {
  const date = new Date()
  date.setMinutes(date.getMinutes() + offsetMinutes)
  date.setSeconds(0, 0)
  const min = date.getMinutes()
  const roundedUp = min % 15 === 0 ? min : (Math.floor(min / 15) + 1) * 15
  if (roundedUp === 60) {
    date.setHours(date.getHours() + 1)
    date.setMinutes(0, 0, 0)
  } else {
    date.setMinutes(roundedUp, 0, 0)
  }
  return date.toISOString()
}

export function createPastDateString(offsetMinutes: number): string {
  // offsetMinutes should be negative to create a past date
  return createTestDate(offsetMinutes).toISOString()
}

/** Past time on a 15-minute boundary (e.g. for PAST_TIME validation tests). */
export function createPastDateStringOn15Min(offsetMinutes: number): string {
  return createTestDateOn15Min(offsetMinutes).toISOString()
}

export function createTestUser(overrides?: Partial<any>) {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    ...overrides,
  }
}

export function createTestVenue(overrides?: Partial<any>) {
  return {
    id: 'test-venue-id',
    name: 'Test Venue',
    address: '123 Test St',
    hourlySeatPrice: 10,
    ownerId: 'test-owner-id',
    ...overrides,
  }
}

/**
 * Default venue hours row shape for a single day (used by getEffectiveVenueHours / getCanonicalVenueHours).
 */
export function createTestVenueHoursRow(dayOfWeek: number, overrides?: Partial<any>) {
  return {
    dayOfWeek,
    isClosed: false,
    openTime: '00:00',
    closeTime: '23:59',
    source: 'manual',
    ...overrides,
  }
}

/**
 * Seven-day venue hours (dayOfWeek 0–6) open 00:00–23:59, source "manual".
 * Use so getCanonicalVenueHours returns non-empty weeklyHours and slot/seat availability passes.
 */
export function createTestVenueHours(overrides?: Partial<ReturnType<typeof createTestVenueHoursRow>>) {
  return [0, 1, 2, 3, 4, 5, 6].map((d) => ({ ...createTestVenueHoursRow(d), ...overrides }))
}

export function createTestTable(overrides?: Partial<any>) {
  return {
    id: 'test-table-id',
    name: 'Table 1',
    venueId: 'test-venue-id',
    seatCount: 4,
    bookingMode: 'individual',
    ...overrides,
  }
}

export function createTestSeat(overrides?: Partial<any>) {
  return {
    id: 'test-seat-id',
    tableId: 'test-table-id',
    label: 'Seat 1',
    position: 1,
    pricePerHour: 10,
    ...overrides,
  }
}

export function createTestReservation(overrides?: Partial<any>) {
  const startAt = createTestDate(60) // 1 hour from now
  const endAt = createTestDate(120) // 2 hours from now

  return {
    id: 'test-reservation-id',
    venueId: 'test-venue-id',
    userId: 'test-user-id',
    seatId: 'test-seat-id',
    tableId: null,
    seatCount: 1,
    status: 'active',
    startAt,
    endAt,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

export function createTestFavoriteVenue(overrides?: Partial<any>) {
  return {
    id: 'test-favorite-venue-id',
    userId: 'test-user-id',
    venueId: 'test-venue-id',
    createdAt: new Date(),
    ...overrides,
  }
}

export function createTestFavoriteTable(overrides?: Partial<any>) {
  return {
    id: 'test-favorite-table-id',
    userId: 'test-user-id',
    tableId: 'test-table-id',
    venueId: 'test-venue-id',
    createdAt: new Date(),
    ...overrides,
  }
}

export function createTestFavoriteSeat(overrides?: Partial<any>) {
  return {
    id: 'test-favorite-seat-id',
    userId: 'test-user-id',
    seatId: 'test-seat-id',
    venueId: 'test-venue-id',
    createdAt: new Date(),
    ...overrides,
  }
}

export function createMockRequest(body?: any, headers?: Record<string, string>): Request {
  return {
    json: async () => body || {},
    headers: new Headers(headers || {}),
  } as Request
}

export function createMockResponse(): {
  json: (data: any) => Response
  status: (code: number) => { json: (data: any) => Response }
} {
  const response = {
    json: (data: any) => {
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    },
    status: (code: number) => ({
      json: (data: any) => {
        return new Response(JSON.stringify(data), {
          status: code,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    }),
  }
  return response as any
}
