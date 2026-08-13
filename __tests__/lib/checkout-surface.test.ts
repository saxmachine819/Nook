// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { shouldUseExpressCheckout, MOBILE_CHECKOUT_MEDIA_QUERY } from "@/lib/checkout-surface"

/**
 * This gate is the only thing standing between desktop customers and a different
 * payment flow: the server creates a PaymentIntent purely because the client asked for
 * `mode: 'express'`. If this returns true on desktop, desktop checkout silently changes.
 */

function stubMatchMedia(matches: boolean) {
  const matchMedia = vi.fn((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: matchMedia,
  })
  return matchMedia
}

function stubCapacitor(isNative: boolean) {
  ;(window as any).Capacitor = { isNativePlatform: () => isNative }
}

describe("shouldUseExpressCheckout", () => {
  beforeEach(() => {
    delete (window as any).Capacitor
  })

  afterEach(() => {
    delete (window as any).Capacitor
  })

  it("is false on a desktop-width browser", () => {
    stubMatchMedia(false)
    expect(shouldUseExpressCheckout()).toBe(false)
  })

  it("is true on a phone-width browser", () => {
    stubMatchMedia(true)
    expect(shouldUseExpressCheckout()).toBe(true)
  })

  it("queries the same breakpoint the booking widget used before", () => {
    const matchMedia = stubMatchMedia(true)
    shouldUseExpressCheckout()
    expect(matchMedia).toHaveBeenCalledWith(MOBILE_CHECKOUT_MEDIA_QUERY)
    expect(MOBILE_CHECKOUT_MEDIA_QUERY).toBe("(max-width: 768px)")
  })

  it("is true in the native shell even when the WebView reports a wide viewport", () => {
    stubMatchMedia(false)
    stubCapacitor(true)
    expect(shouldUseExpressCheckout()).toBe(true)
  })

  it("falls back to the viewport when Capacitor says it is not native", () => {
    stubMatchMedia(false)
    stubCapacitor(false)
    expect(shouldUseExpressCheckout()).toBe(false)
  })

  it("does not throw when matchMedia is unavailable", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: undefined,
    })
    expect(shouldUseExpressCheckout()).toBe(false)
  })
})
