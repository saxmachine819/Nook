import { isNativeApp } from "@/lib/native-app"

/** Matches the breakpoint the booking widget already used to pick the mobile checkout. */
export const MOBILE_CHECKOUT_MEDIA_QUERY = "(max-width: 768px)"

/**
 * Whether this client should get the express (Apple Pay / Google Pay) checkout instead
 * of Stripe's embedded Checkout form.
 *
 * Deliberately narrow: desktop browsers must keep the embedded flow untouched, so this
 * returns false for anything that isn't a small viewport or the Capacitor shell. The
 * server only creates a PaymentIntent when the client asks via `mode: 'express'`, so
 * this function is the single switch between the two payment paths.
 */
export function shouldUseExpressCheckout(): boolean {
  if (typeof window === "undefined") return false

  // The native app is always a phone, even when the WebView reports a wide viewport.
  if (isNativeApp()) return true

  return Boolean(window.matchMedia?.(MOBILE_CHECKOUT_MEDIA_QUERY).matches)
}
