import { vi } from 'vitest'

// Mock environment variables
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'

// Global test setup
beforeEach(() => {
  // Reset mocks before each test
  vi.clearAllMocks()
})
