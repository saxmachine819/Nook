/**
 * Test utilities and factory functions for creating test data
 */

export function createTestDate(offsetMinutes = 0): Date {
  const date = new Date()
  date.setMinutes(date.getMinutes() + offsetMinutes)
  return date
}

export function createTestDateString(offsetMinutes = 0): string {
  return createTestDate(offsetMinutes).toISOString()
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
