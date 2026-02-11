/**
 * VenuePreviewSheet swipe-to-close tests.
 * Requires jsdom for React component and pointer events.
 * Note: If the project's jsdom has ESM/require issues, these tests may fail to start
 * (same as other jsdom tests like admin.test.tsx); the assertions are valid once jsdom runs.
 */

// @vitest-environment jsdom

import React from "react"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { VenuePreviewSheet } from "@/components/explore/VenuePreviewSheet"

const mockPush = vi.fn()
const mockReplace = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => "/explore",
}))

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({
    showToast: vi.fn(),
    ToastComponent: null,
  }),
}))

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
}))

vi.mock("@/lib/hooks/use-favorite-toggle", () => ({
  useFavoriteToggle: () => ({
    isFavorited: false,
    toggleFavorite: vi.fn(),
    isLoading: false,
  }),
}))

const minimalVenue = {
  id: "v1",
  name: "Test Venue",
  minPrice: 10,
  maxPrice: 20,
  tags: [],
  capacity: 20,
  imageUrls: [],
}

function getSheetElement() {
  return screen.getByTestId("venue-preview-sheet")
}

function getScrollContainer() {
  return screen.getByTestId("venue-preview-sheet-scroll")
}

describe("VenuePreviewSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls onClose when user swipes down past threshold (pointer events)", async () => {
    const onClose = vi.fn()
    render(
      <VenuePreviewSheet
        open
        venue={minimalVenue}
        onClose={onClose}
      />
    )

    const scroll = getScrollContainer()
    const pointerId = 1
    const startY = 200

    // pointerdown at top (scrollTop will be 0 for initial render) - must be touch type
    scroll.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientY: startY,
        pointerId,
        pointerType: "touch",
        bubbles: true,
      })
    )

    // pointermove: drag down 90px (past 80px threshold)
    scroll.dispatchEvent(
      new PointerEvent("pointermove", {
        clientY: startY + 90,
        pointerId,
        pointerType: "touch",
        bubbles: true,
      })
    )

    // pointerup
    scroll.dispatchEvent(
      new PointerEvent("pointerup", {
        clientY: startY + 90,
        pointerId,
        pointerType: "touch",
        bubbles: true,
      })
    )

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("does not call onClose when swipe down is below threshold", async () => {
    const onClose = vi.fn()
    render(
      <VenuePreviewSheet
        open
        venue={minimalVenue}
        onClose={onClose}
      />
    )

    const scroll = getScrollContainer()
    const pointerId = 1
    const startY = 200

    scroll.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientY: startY,
        pointerId,
        pointerType: "touch",
        bubbles: true,
      })
    )

    // Only 40px down (below 80px threshold)
    scroll.dispatchEvent(
      new PointerEvent("pointermove", {
        clientY: startY + 40,
        pointerId,
        pointerType: "touch",
        bubbles: true,
      })
    )

    scroll.dispatchEvent(
      new PointerEvent("pointerup", {
        clientY: startY + 40,
        pointerId,
        pointerType: "touch",
        bubbles: true,
      })
    )

    expect(onClose).not.toHaveBeenCalled()
  })

  it("backdrop tap still calls onClose", () => {
    const onClose = vi.fn()
    render(
      <VenuePreviewSheet
        open
        venue={minimalVenue}
        onClose={onClose}
      />
    )

    const backdrop = screen.getByRole("button", { name: /close venue preview/i })
    fireEvent.click(backdrop)

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
