/**
 * Admin Approvals Page Tests
 * 
 * Tests for the admin approvals page at /admin/approvals
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

vi.mock('@/lib/stripe', () => ({
  stripe: {
    accounts: {
      retrieve: vi.fn().mockResolvedValue({ charges_enabled: true }),
    },
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/admin/approvals',
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
    ToastComponent: null,
  }),
}))

import AdminApprovalsPage from '@/app/(root)/admin/approvals/page'

describe('AdminApprovalsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrismaFindMany.mockResolvedValue([])
  })

  describe('when user is not authenticated', () => {
    it('shows not authorized message', async () => {
      mockAuth.mockResolvedValue(null)

      const component = await AdminApprovalsPage()
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

      const component = await AdminApprovalsPage()
      render(component)

      expect(screen.getByText('Not authorized')).toBeInTheDocument()
    })
  })

  describe('when user is authenticated and is admin', () => {
    it('shows approvals page with submitted venues', async () => {
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
          stripeAccountId: null as string | null,
          owner: { id: 'owner-1', email: 'owner@example.com', name: 'Owner' },
          submittedAt: new Date('2024-01-01'),
          tables: [{ seats: [{ pricePerHour: 10 }] }],
          venueHours: [{ dayOfWeek: 1 }],
          deals: [],
          heroImageUrl: 'test.jpg',
          imageUrls: null,
          rulesText: 'Test rules',
          openingHoursJson: null,
        },
      ]

      mockPrismaFindMany.mockResolvedValue(mockVenues)

      const component = await AdminApprovalsPage()
      render(component)

      expect(screen.getByText('Venue Approvals')).toBeInTheDocument()
      expect(screen.getByText('Review and approve venue submissions')).toBeInTheDocument()
      expect(screen.getByText('Test Venue')).toBeInTheDocument()
      expect(screen.getByText('Stripe Approved?')).toBeInTheDocument()
    })

    it('shows empty state when no venues are submitted', async () => {
      const mockUser = {
        id: 'admin-id',
        email: 'admin@example.com',
        name: 'Admin User',
      }
      mockAuth.mockResolvedValue({ user: mockUser })
      mockIsAdmin.mockReturnValue(true)

      mockPrismaFindMany.mockResolvedValue([])

      const component = await AdminApprovalsPage()
      render(component)

      expect(screen.getByText('No pending approvals')).toBeInTheDocument()
      expect(screen.getByText('There are no venues waiting for approval.')).toBeInTheDocument()
    })
  })
})
