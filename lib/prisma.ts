import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Warn in dev if using direct connection (port 5432) — use pooler (6543) for local
if (process.env.NODE_ENV === 'development') {
  try {
    const u = new URL(process.env.DATABASE_URL || '')
    const isDirect = u.hostname?.includes('.supabase.co') && !u.hostname?.includes('pooler') && (u.port || '5432') === '5432'
    if (isDirect) {
      console.warn(
        '[Nook] DATABASE_URL is using Supabase direct connection (port 5432). From local, use the connection pooler (port 6543). Run: node scripts/check-db-env.mjs'
      )
    }
  } catch (_) {}
}

// Initialize Prisma with error handling
let prisma: PrismaClient
try {
  prisma = globalForPrisma.prisma ?? new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
} catch (error) {
  console.error('❌ Prisma initialization failed:', error)
  // Still export prisma but it might fail on use
  prisma = globalForPrisma.prisma ?? new PrismaClient()
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
}

export { prisma }