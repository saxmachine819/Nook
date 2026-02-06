/**
 * Admin Page Tests
 * 
 * Tests for the admin-only landing page at /admin
 * 
 * Note: These tests require jsdom environment to run React component tests.
 * To run these tests, configure vitest to use jsdom for this test file,
 * or run with: vitest --environment=jsdom
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

// Import after mocks are set up
import AdminPage from '@/app/(root)/admin/page'

describe('AdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when user is not authenticated', () => {
    it('shows not authorized message', async () => {
      mockAuth.mockResolvedValue(null)

      const component = await AdminPage()
      render(component)

      expect(screen.getByText('Not authorized')).toBeInTheDocument()
      expect(screen.getByText('You do not have permission to access this page.')).toBeInTheDocument()
      expect(screen.getByText('Go to Home')).toBeInTheDocument()
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

      const component = await AdminPage()
      render(component)

      expect(screen.getByText('Not authorized')).toBeInTheDocument()
      expect(screen.getByText('You do not have permission to access this page.')).toBeInTheDocument()
      expect(screen.getByText('Go to Home')).toBeInTheDocument()
    })
  })

  describe('when user is authenticated and is admin', () => {
    it('shows admin landing page with three links', async () => {
      const mockUser = {
        id: 'admin-id',
        email: 'admin@example.com',
        name: 'Admin User',
      }
      mockAuth.mockResolvedValue({ user: mockUser })
      mockIsAdmin.mockReturnValue(true)

      const component = await AdminPage()
      render(component)

      // Check page title
      expect(screen.getByText('Admin Panel')).toBeInTheDocument()
      expect(screen.getByText('Manage approvals, venues, and users')).toBeInTheDocument()

      // Check all three admin sections
      expect(screen.getByText('Approvals')).toBeInTheDocument()
      expect(screen.getByText('Review and approve venue submissions')).toBeInTheDocument()

      expect(screen.getByText('Venues')).toBeInTheDocument()
      expect(screen.getByText('Manage all venues in the system')).toBeInTheDocument()

      expect(screen.getByText('Users')).toBeInTheDocument()
      expect(screen.getByText('View and manage user accounts')).toBeInTheDocument()

      // Check links
      const approvalsLink = screen.getByText('Approvals').closest('a')
      expect(approvalsLink).toHaveAttribute('href', '/admin/approvals')

      const venuesLink = screen.getByText('Venues').closest('a')
      expect(venuesLink).toHaveAttribute('href', '/admin/venues')

      const usersLink = screen.getByText('Users').closest('a')
      expect(usersLink).toHaveAttribute('href', '/admin/users')
    })
  })

  describe('when user session exists but user object is missing', () => {
    it('shows not authorized message', async () => {
      mockAuth.mockResolvedValue({ user: null })

      const component = await AdminPage()
      render(component)

      expect(screen.getByText('Not authorized')).toBeInTheDocument()
    })
  })
})
