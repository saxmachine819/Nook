/**
 * Admin Venues Page Tests
 * 
 * Tests for the admin venues page at /admin/venues
 */

// @vitest-environment jsdom

import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const { mockAuth, mockIsAdmin, mockPrismaFindMany } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockIsAdmin: vi.fn(),
  mockPrismaFindMany: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

vi.mock('@/lib/venue-auth', () => ({
  isAdmin: (user: { email?: string | null } | null | undefined) => mockIsAdmin(user),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    venue: {
      findMany: mockPrismaFindMany,
    },
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/admin/venues',
  useSearchParams: () => new URLSearchParams(),
}))

import AdminVenuesPage from '@/app/(root)/admin/venues/page'

describe('AdminVenuesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrismaFindMany.mockResolvedValue([])
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

      mockPrismaFindMany.mockResolvedValue(mockVenues)

      const component = await AdminVenuesPage({ searchParams: {} })
      render(component)

      expect(screen.getByText('Venues')).toBeInTheDocument()
      expect(screen.getByText('Manage all venues in the system')).toBeInTheDocument()
    })
  })
})
