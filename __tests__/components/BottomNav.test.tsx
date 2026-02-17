/**
 * BottomNav component tests.
 * Requires jsdom for React component tests.
 * Run with: vitest --environment=jsdom (or use @vitest-environment jsdom per file).
 */
// @vitest-environment jsdom

import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BottomNav } from '@/components/layout/BottomNav'

const mockUseSession = vi.fn()
const mockUsePathname = vi.fn()
const mockUseVenueSummary = vi.fn()

vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}))

vi.mock('@/lib/hooks', () => ({
  useVenueSummary: () => mockUseVenueSummary(),
}))

describe('BottomNav', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePathname.mockReturnValue('/')
  })

  describe('when user is signed out', () => {
    it('does not show Manage link', async () => {
      mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' })
      mockUseVenueSummary.mockReturnValue({ data: undefined, isLoading: false })

      render(<BottomNav />)

      await waitFor(() => {
        expect(screen.getByText('Login')).toBeInTheDocument()
      })

      expect(screen.queryByText('Manage')).not.toBeInTheDocument()
    })
  })

  describe('when user is signed in', () => {
    const baseUser = { id: 'user-1', name: 'Test', email: 'test@example.com' }

    it('does not show Manage link when user has 0 venues', () => {
      mockUseSession.mockReturnValue({
        data: { user: baseUser },
        status: 'authenticated',
      })
      mockUseVenueSummary.mockReturnValue({
        data: { count: 0, singleVenueId: null },
        isLoading: false,
      })

      render(<BottomNav />)

      expect(screen.queryByText('Manage')).not.toBeInTheDocument()
    })

    it('shows Manage link with single-venue href when user has 1 venue', () => {
      mockUseSession.mockReturnValue({
        data: { user: baseUser },
        status: 'authenticated',
      })
      mockUseVenueSummary.mockReturnValue({
        data: { count: 1, singleVenueId: 'venue-1' },
        isLoading: false,
      })

      render(<BottomNav />)

      expect(screen.getByText('Manage')).toBeInTheDocument()
      const manageLink = screen.getByText('Manage').closest('a')
      expect(manageLink).toHaveAttribute('href', '/venue/dashboard/venue-1')
    })

    it('shows Manage link with dashboard href when user has 2+ venues', () => {
      mockUseSession.mockReturnValue({
        data: { user: baseUser },
        status: 'authenticated',
      })
      mockUseVenueSummary.mockReturnValue({
        data: { count: 2, singleVenueId: null },
        isLoading: false,
      })

      render(<BottomNav />)

      expect(screen.getByText('Manage')).toBeInTheDocument()
      const manageLink = screen.getByText('Manage').closest('a')
      expect(manageLink).toHaveAttribute('href', '/venue/dashboard')
    })
  })
})
