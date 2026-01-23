import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { isAdmin, canEditVenue } from '@/lib/venue-auth'

describe('venue-auth utility functions', () => {
  const originalEnv = process.env.ADMIN_EMAILS

  beforeEach(() => {
    // Reset environment variable
    delete process.env.ADMIN_EMAILS
  })

  afterEach(() => {
    // Restore original environment variable
    if (originalEnv) {
      process.env.ADMIN_EMAILS = originalEnv
    }
  })

  describe('isAdmin', () => {
    it('returns false if user has no email', () => {
      expect(isAdmin(null)).toBe(false)
      expect(isAdmin({})).toBe(false)
      expect(isAdmin({ email: null })).toBe(false)
    })

    it('returns false if ADMIN_EMAILS is not set', () => {
      const user = { email: 'admin@example.com' }
      expect(isAdmin(user)).toBe(false)
    })

    it('returns true if user email is in ADMIN_EMAILS', () => {
      process.env.ADMIN_EMAILS = 'admin@example.com,other@example.com'
      const user = { email: 'admin@example.com' }
      expect(isAdmin(user)).toBe(true)
    })

    it('returns false if user email is not in ADMIN_EMAILS', () => {
      process.env.ADMIN_EMAILS = 'admin@example.com,other@example.com'
      const user = { email: 'user@example.com' }
      expect(isAdmin(user)).toBe(false)
    })

    it('is case insensitive', () => {
      process.env.ADMIN_EMAILS = 'admin@example.com'
      const user = { email: 'ADMIN@EXAMPLE.COM' }
      expect(isAdmin(user)).toBe(true)
    })

    it('handles whitespace in ADMIN_EMAILS', () => {
      process.env.ADMIN_EMAILS = ' admin@example.com , other@example.com '
      const user = { email: 'admin@example.com' }
      expect(isAdmin(user)).toBe(true)
    })
  })

  describe('canEditVenue', () => {
    it('returns false if user is null', () => {
      const venue = { ownerId: 'owner-id' }
      expect(canEditVenue(null, venue)).toBe(false)
    })

    it('returns true if user is admin', () => {
      process.env.ADMIN_EMAILS = 'admin@example.com'
      const user = { id: 'user-id', email: 'admin@example.com' }
      const venue = { ownerId: 'different-owner-id' }
      expect(canEditVenue(user, venue)).toBe(true)
    })

    it('returns true if user is the venue owner', () => {
      const user = { id: 'owner-id', email: 'owner@example.com' }
      const venue = { ownerId: 'owner-id' }
      expect(canEditVenue(user, venue)).toBe(true)
    })

    it('returns false if user is not owner and not admin', () => {
      const user = { id: 'user-id', email: 'user@example.com' }
      const venue = { ownerId: 'different-owner-id' }
      expect(canEditVenue(user, venue)).toBe(false)
    })

    it('returns false for legacy venues (ownerId = null) unless user is admin', () => {
      const user = { id: 'user-id', email: 'user@example.com' }
      const venue = { ownerId: null }
      expect(canEditVenue(user, venue)).toBe(false)
    })

    it('returns true for legacy venues if user is admin', () => {
      process.env.ADMIN_EMAILS = 'admin@example.com'
      const user = { id: 'user-id', email: 'admin@example.com' }
      const venue = { ownerId: null }
      expect(canEditVenue(user, venue)).toBe(true)
    })
  })
})
