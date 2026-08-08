/**
 * Client helpers for detecting the Capacitor native shell and calling plugins.
 */

export const UPCOMING_CACHE_KEY = "nooc.upcomingReservations.v1"

export type NativePlatform = "ios" | "android" | "web"

export function getCapacitor():
  | {
      isNativePlatform?: () => boolean
      getPlatform?: () => string
      Plugins?: Record<string, unknown>
    }
  | undefined {
  if (typeof window === "undefined") return undefined
  return (window as Window & { Capacitor?: any }).Capacitor
}

export function isNativeApp(): boolean {
  const cap = getCapacitor()
  try {
    return Boolean(cap?.isNativePlatform?.())
  } catch {
    return false
  }
}

export function getNativePlatform(): NativePlatform {
  const cap = getCapacitor()
  const platform = cap?.getPlatform?.()
  if (platform === "ios" || platform === "android") return platform
  return "web"
}

export interface CachedReservation {
  id: string
  venueName?: string | null
  startAt?: string | null
  endAt?: string | null
}

export function writeUpcomingCache(items: CachedReservation[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(UPCOMING_CACHE_KEY, JSON.stringify(items.slice(0, 20)))
  } catch {
    // ignore quota / private mode
  }
}

export function readUpcomingCache(): CachedReservation[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(UPCOMING_CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
