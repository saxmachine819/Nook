import { vi } from 'vitest'

/**
 * Mock Prisma Client
 * This allows us to mock database operations in tests
 */
export function createMockPrisma() {
  const reservationCreateFn = vi.fn((args: any) => {
    const data = args.data
    return Promise.resolve({
      id: 'test-reservation-id',
      ...data,
      venue: data.venueId ? {
        id: data.venueId,
        name: 'Test Venue',
        owner: { email: 'owner@example.com' },
        tables: [],
        timezone: 'UTC',
      } : undefined,
      table: data.tableId ? { id: data.tableId, name: 'Test Table' } : undefined,
      seat: data.seatId ? { id: data.seatId, table: { id: 'table-1', name: 'Table 1' } } : undefined,
    })
  })

  return {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    venue: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    table: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    seat: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    reservation: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: reservationCreateFn,
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    seatBlock: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    favoriteVenue: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    favoriteTable: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    favoriteSeat: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((callback) => {
      const tx = {
        user: { findUnique: vi.fn(), update: vi.fn() },
        venue: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
        reservation: {
          findMany: vi.fn(),
          findFirst: vi.fn(),
          updateMany: vi.fn(),
          create: reservationCreateFn,
        },
        table: { updateMany: vi.fn() },
        seat: { updateMany: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
        auditLog: { create: vi.fn() },
        favoriteVenue: {
          findUnique: vi.fn(),
          create: vi.fn(),
          upsert: vi.fn(),
          delete: vi.fn(),
          deleteMany: vi.fn(),
        },
        favoriteTable: {
          findUnique: vi.fn(),
          create: vi.fn(),
          upsert: vi.fn(),
          delete: vi.fn(),
          deleteMany: vi.fn(),
        },
        favoriteSeat: {
          findUnique: vi.fn(),
          create: vi.fn(),
          upsert: vi.fn(),
          delete: vi.fn(),
          deleteMany: vi.fn(),
        },
      }
      return callback(tx)
    }),
  }
}

/**
 * Mock NextAuth session
 */
export function createMockSession(user?: any) {
  return {
    user: user || {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }
}

/**
 * Mock NextAuth auth() function
 */
export function mockAuth(session: any = null) {
  const authModule = require('@/lib/auth')
  vi.spyOn(authModule, 'auth').mockResolvedValue(session)
}
