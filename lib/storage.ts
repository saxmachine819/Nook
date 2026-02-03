/**
 * Safe localStorage utilities for first-visit UI flags and similar.
 * Catches exceptions (e.g. Safari private mode, quota exceeded).
 *
 * LocalStorage keys and behavior:
 * - nooc_seen_explorer_v1: "true" when banner has been dismissed
 * - nooc_location_prompted_v1: "true" when CTA was clicked (optional, for future use)
 * - nooc_location_last_outcome_v1: "granted" | "denied" | "error" | "unknown" (optional, for future use)
 */

export function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function safeSet(key: string, value: string): boolean {
  if (typeof window === "undefined") return false
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}
