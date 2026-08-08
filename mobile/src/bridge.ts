/**
 * Native shell bootstrap for Capacitor.
 * Loaded by the WebView once the remote Next.js app detects Capacitor.
 * Also used as the TypeScript source of truth for mobile/src.
 */

export const NATIVE_BRIDGE_FLAG = "__NOOC_NATIVE_BRIDGE__"

export type NativePlatform = "ios" | "android" | "web"

export interface CachedReservation {
  id: string
  venueName?: string | null
  startAt?: string | null
  endAt?: string | null
}

export const UPCOMING_CACHE_KEY = "nooc.upcomingReservations.v1"

export function isProbablyNativeWebView(): boolean {
  if (typeof window === "undefined") return false
  const w = window as Window & {
    Capacitor?: { isNativePlatform?: () => boolean }
  }
  return Boolean(w.Capacitor?.isNativePlatform?.())
}
