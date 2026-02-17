/**
 * Profile Page Tests
 *
 * Note: These tests require jsdom environment to run React component tests.
 * To run these tests, configure vitest to use jsdom for this test file,
 * or run with: vitest --environment=jsdom
 */

// @vitest-environment jsdom

import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import ProfilePage from '@/app/(root)/profile/page'

// Mock next-auth/react
const mockUseSession = vi.fn()
const mockSignIn = vi.fn()
const mockSignOut = vi.fn()

vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
  signIn: () => mockSignIn(),
  signOut: () => mockSignOut(),
}))

// Mock next/navigation
const mockUseSearchParams = vi.fn(() => ({
  get: vi.fn(() => null),
}))
const mockUseRouter = vi.fn(() => ({
  replace: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockUseSearchParams(),
  useRouter: () => mockUseRouter(),
}))

const mockUseMe = vi.fn()
const mockUseMyVenuesCount = vi.fn()

vi.mock('@/lib/hooks', () => ({
  useMe: (enabled: boolean) => mockUseMe(enabled),
  useMyVenuesCount: (enabled: boolean) => mockUseMyVenuesCount(enabled),
}))

global.fetch = vi.fn()

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(global.fetch).mockReset()
    mockUseMe.mockReset()
    mockUseMyVenuesCount.mockReset()
  })

  describe('when user is not authenticated', () => {
    it('shows sign in UI', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
      })
      mockUseMe.mockReturnValue({ data: null, isLoading: false })
      mockUseMyVenuesCount.mockReturnValue({ data: null, isLoading: false })

      render(<ProfilePage />)

      expect(screen.getByText('Sign in')).toBeInTheDocument()
      expect(screen.getByText('Sign in with Google')).toBeInTheDocument()
    })
  })

  describe('when user is authenticated', () => {
    const mockSession = {
      user: {
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
      },
    }

    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: mockSession,
        status: 'authenticated',
      })
      mockUseMe.mockReturnValue({ data: { isAdmin: false }, isLoading: false })
      mockUseMyVenuesCount.mockReturnValue({ data: { count: 0 }, isLoading: false })
    })

    it('shows empty state when user has 0 venues', async () => {
      mockUseMyVenuesCount.mockReturnValue({ data: { count: 0 }, isLoading: false })

      render(<ProfilePage />)

      await waitFor(() => {
        expect(screen.getByText('List your venue on Nooc')).toBeInTheDocument()
      })

      expect(
        screen.getByText(
          'If you manage a café or hotel lobby with workspace seating, you can request to be added to Nooc.'
        )
      ).toBeInTheDocument()

      const addButton = screen.getByText('Add your venue')
      expect(addButton).toBeInTheDocument()
      expect(addButton.closest('a')).toHaveAttribute('href', '/venue/onboard')
    })

    it('shows dashboard button when user has venues', async () => {
      mockUseMyVenuesCount.mockReturnValue({ data: { count: 1 }, isLoading: false })

      render(<ProfilePage />)

      // Wait for venues to load
      await waitFor(() => {
        expect(screen.getByText('Open Venue Dashboard')).toBeInTheDocument()
      })

      const dashboardButton = screen.getByText('Open Venue Dashboard')
      expect(dashboardButton).toBeInTheDocument()
      expect(dashboardButton.closest('a')).toHaveAttribute('href', '/venue/dashboard')
    })

    it('handles fetch error gracefully', async () => {
      mockUseMyVenuesCount.mockReturnValue({ data: null, isLoading: false, isError: true })

      render(<ProfilePage />)

      // Should show empty state after error
      await waitFor(() => {
        expect(screen.getByText('List your venue on Nooc')).toBeInTheDocument()
      })
    })

    it('handles non-ok response gracefully', async () => {
      mockUseMyVenuesCount.mockReturnValue({ data: null, isLoading: false, isError: true })

      render(<ProfilePage />)

      // Should show empty state after error
      await waitFor(() => {
        expect(screen.getByText('List your venue on Nooc')).toBeInTheDocument()
      })
    })

    it('shows loading state while fetching venues', () => {
      mockUseMyVenuesCount.mockReturnValue({ data: null, isLoading: true })

      const { container } = render(<ProfilePage />)

      // The component uses Card with animate-pulse when loading
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
      expect(screen.queryByText('My Venues')).not.toBeInTheDocument()
    })

    it('shows admin button when user is admin', async () => {
      mockUseMe.mockReturnValue({ data: { isAdmin: true }, isLoading: false })

      render(<ProfilePage />)

      // Wait for admin button to appear
      await waitFor(() => {
        expect(screen.getByText('Go to Admin Panel')).toBeInTheDocument()
      })

      const adminButton = screen.getByText('Go to Admin Panel')
      expect(adminButton).toBeInTheDocument()
      expect(adminButton.closest('a')).toHaveAttribute('href', '/admin')
      expect(screen.getByText('Admin')).toBeInTheDocument()
    })

    it('does not show admin button when user is not admin', async () => {
      mockUseMe.mockReturnValue({ data: { isAdmin: false }, isLoading: false })

      render(<ProfilePage />)

      // Wait for content to load
      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument()
      })

      // Admin button should not be present
      expect(screen.queryByText('Go to Admin Panel')).not.toBeInTheDocument()
      expect(screen.queryByText('Admin')).not.toBeInTheDocument()
    })
  })

  describe('when session is loading', () => {
    it('shows loading state', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'loading',
      })
      mockUseMe.mockReturnValue({ data: null, isLoading: false })
      mockUseMyVenuesCount.mockReturnValue({ data: null, isLoading: false })

      render(<ProfilePage />)

      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })
  })
})
