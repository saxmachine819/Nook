/**
 * Admin Venues Page Tests
 * 
 * Tests for the admin venues page at /admin/venues
 */

// @vitest-environment jsdom

import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock auth function
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

// Mock isAdmin function
const mockIsAdmin = vi.fn()
vi.mock('@/lib/venue-auth', () => ({
  isAdmin: (user: { email?: string | null } | null | undefined) => mockIsAdmin(user),
}))

// Mock Prisma
const mockPrisma = {
  venue: {
    findMany: vi.fn(),
  },
}
vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

// Import after mocks are set up
import AdminVenuesPage from '@/app/(root)/admin/venues/page'

describe('AdminVenuesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.venue.findMany.mockResolvedValue([])
  })

  describe('when user is not authenticated', () => {
    it('shows not authorized message', async () => {
      mockAuth.mockResolvedValue(null)

      const component = await AdminVenuesPage({ searchParams: {} })
      render(component)

      expect(screen.getByText('Not authorized')).toBeInTheDocument()
      expect(screen.getByText('You do not have permission to access this page.')).toBeInTheDocument()
    })
  })

  describe('when user is authenticated but not admin', () => {
    it('shows not authorized message', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'user@example.com',
        name: 'Test User',
      }
      mockAuth.mockResolvedValue({ user: mockUser })
      mockIsAdmin.mockReturnValue(false)

      const component = await AdminVenuesPage({ searchParams: {} })
      render(component)

      expect(screen.getByText('Not authorized')).toBeInTheDocument()
    })
  })

  describe('when user is authenticated and is admin', () => {
    it('shows venues page with search', async () => {
      const mockUser = {
        id: 'admin-id',
        email: 'admin@example.com',
        name: 'Admin User',
      }
      mockAuth.mockResolvedValue({ user: mockUser })
      mockIsAdmin.mockReturnValue(true)

      const mockVenues = [
        {
          id: 'venue-1',
          name: 'Test Venue',
          address: '123 Test St',
          onboardingStatus: 'APPROVED',
          createdAt: new Date('2024-01-01'),
          owner: {
            id: 'owner-1',
            email: 'owner@example.com',
            name: 'Owner',
          },
        },
      ]

      mockPrisma.venue.findMany.mockResolvedValue(mockVenues)

      const component = await AdminVenuesPage({ searchParams: {} })
      render(component)

      expect(screen.getByText('Venues')).toBeInTheDocument()
      expect(screen.getByText('Manage all venues in the system')).toBeInTheDocument()
    })
  })
})
