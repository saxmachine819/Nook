/**
 * Profile Page Tests
 * 
 * Note: These tests require jsdom environment to run React component tests.
 * To run these tests, configure vitest to use jsdom for this test file,
 * or run with: vitest --environment=jsdom
 */

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

// Mock fetch globally
global.fetch = vi.fn()

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset fetch mock
    vi.mocked(global.fetch).mockReset()
  })

  describe('when user is not authenticated', () => {
    it('shows sign in UI', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
      })

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
    })

    it('shows empty state when user has 0 venues', async () => {
      // Mock fetch to return empty venues array
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ venues: [] }),
      } as Response)

      render(<ProfilePage />)

      // Wait for venues to load
      await waitFor(() => {
        expect(screen.getByText('List your venue on Nook')).toBeInTheDocument()
      })

      expect(
        screen.getByText(
          'If you manage a café or hotel lobby with workspace seating, you can request to be added to Nook.'
        )
      ).toBeInTheDocument()

      const addButton = screen.getByText('Add your venue')
      expect(addButton).toBeInTheDocument()
      expect(addButton.closest('a')).toHaveAttribute('href', '/venue/onboard')
    })

    it('shows dashboard button when user has venues', async () => {
      const mockVenues = [
        {
          id: 'venue-1',
          name: 'Test Venue',
          address: '123 Test St',
          thumbnail: null,
        },
      ]

      // Mock fetch to return venues
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ venues: mockVenues }),
      } as Response)

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
      // Mock fetch to fail
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))

      render(<ProfilePage />)

      // Should show empty state after error
      await waitFor(() => {
        expect(screen.getByText('List your venue on Nook')).toBeInTheDocument()
      })
    })

    it('handles non-ok response gracefully', async () => {
      // Mock fetch to return non-ok response
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      } as Response)

      render(<ProfilePage />)

      // Should show empty state after error
      await waitFor(() => {
        expect(screen.getByText('List your venue on Nook')).toBeInTheDocument()
      })
    })

    it('shows loading state while fetching venues', () => {
      // Mock fetch to never resolve (simulate loading)
      vi.mocked(global.fetch).mockImplementationOnce(
        () =>
          new Promise(() => {
            // Never resolves
          })
      )

      render(<ProfilePage />)

      expect(screen.getByText('Loading venues…')).toBeInTheDocument()
    })

    it('shows admin button when user is admin', async () => {
      // Mock fetch to return isAdmin: true
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ venues: [], isAdmin: true }),
      } as Response)

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
      // Mock fetch to return isAdmin: false
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ venues: [], isAdmin: false }),
      } as Response)

      render(<ProfilePage />)

      // Wait for venues to load
      await waitFor(() => {
        expect(screen.getByText('List your venue on Nook')).toBeInTheDocument()
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

      render(<ProfilePage />)

      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })
  })
})
