/**
 * Admin Users Page Tests
 * 
 * Tests for the admin users page at /admin/users
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
    user: {
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
  usePathname: () => '/admin/users',
  useSearchParams: () => new URLSearchParams(),
}))

global.fetch = vi.fn()

import AdminUsersPage from '@/app/(root)/admin/users/page'

describe('AdminUsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrismaFindMany.mockResolvedValue([])
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ users: [] }),
    })
  })

  describe('when user is not authenticated', () => {
    it('shows not authorized message', async () => {
      mockAuth.mockResolvedValue(null)

      const component = await AdminUsersPage({ searchParams: {} })
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

      const component = await AdminUsersPage({ searchParams: {} })
      render(component)

      expect(screen.getByText('Not authorized')).toBeInTheDocument()
    })
  })

  describe('when user is authenticated and is admin', () => {
    it('shows users page with search', async () => {
      const mockUser = {
        id: 'admin-id',
        email: 'admin@example.com',
        name: 'Admin User',
      }
      mockAuth.mockResolvedValue({ user: mockUser })
      mockIsAdmin.mockReturnValue(true)

      const mockUsers = [
        {
          id: 'user-1',
          name: 'Test User',
          email: 'test@example.com',
          createdAt: new Date('2024-01-01'),
          isAdmin: false,
          venuesOwnedCount: 2,
          reservationsCount: 5,
          lastReservationAt: new Date('2024-01-15'),
        },
      ]

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ users: mockUsers }),
      })

      const component = await AdminUsersPage({ searchParams: {} })
      render(component)

      expect(screen.getByText('Users')).toBeInTheDocument()
      expect(screen.getByText('View and manage user accounts')).toBeInTheDocument()
    })
  })
})
