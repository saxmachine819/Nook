import { vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom'

// Mock environment variables
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'

// jsdom doesn't implement ResizeObserver; components (e.g. BottomNav) that use it
// need a stub or they throw ReferenceError in jsdom-environment tests. Firing the
// callback on observe() (like a real browser does shortly after) keeps components
// that publish measurements on resize actually testable, not just crash-free.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    #callback: ResizeObserverCallback
    constructor(callback: ResizeObserverCallback) {
      this.#callback = callback
    }
    observe(target: Element) {
      this.#callback([{ target } as ResizeObserverEntry], this)
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver
}

// Global test setup
beforeEach(() => {
  // Reset mocks before each test
  vi.clearAllMocks()
})
