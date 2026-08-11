"use client"

import { useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import {
  getCapacitor,
  getNativePlatform,
  isNativeApp,
  writeUpcomingCache,
} from "@/lib/native-app"

type CapPluginListener = { remove: () => Promise<void> | void }

async function getPlugin<T = any>(name: string): Promise<T | null> {
  const cap = getCapacitor() as any
  if (!cap) return null
  if (cap.Plugins?.[name]) return cap.Plugins[name] as T
  // Capacitor 5+ registerPlugin path when bridge is present
  if (typeof cap.registerPlugin === "function") {
    try {
      return cap.registerPlugin(name) as T
    } catch {
      return null
    }
  }
  return null
}

/**
 * Bootstraps native-only behavior when the Capacitor shell loads nooc.io:
 * - marks document for CSS
 * - registers push token with the API
 * - caches upcoming reservations for offline fallback
 * - listens for deep links / app URL opens
 */
export function NativeAppBootstrap() {
  const { data: session, status } = useSession()
  const registeredToken = useRef<string | null>(null)

  useEffect(() => {
    if (!isNativeApp()) return
    document.documentElement.dataset.nativeApp = "true"
    document.documentElement.dataset.nativePlatform = getNativePlatform()

    // WKWebView doesn't always have its real safeAreaInsets established by
    // the time this page first paints — measured (via a debug overlay) at
    // 0 immediately on launch, then correctly non-zero ~500ms later with no
    // app code involved. CSS depending on env(safe-area-inset-*) (body's
    // padding-top, the bottom nav, full-bleed map containers) resolves once
    // at style-computation time and does NOT appear to auto-recompute when
    // the underlying native value later changes — a plain forced reflow
    // (reading offsetHeight) wasn't sufficient to un-stick it either.
    // What reliably works: creating a fresh element whose inline style
    // reads env(safe-area-inset-top) and measuring it, which forces WebKit
    // to resolve that value from scratch. Poll with that technique for the
    // first two seconds; once it returns a real value, force one global
    // style recalculation (toggling a class) so already-painted elements
    // pick it up, then stop.
    let cancelled = false
    const probeSafeArea = (): number => {
      const probe = document.createElement("div")
      probe.style.cssText =
        "position:fixed;top:env(safe-area-inset-top,-1px);height:0;width:0;pointer-events:none;"
      document.body.appendChild(probe)
      const top = probe.getBoundingClientRect().top
      probe.remove()
      return top
    }
    const attempts = [0, 50, 100, 200, 400, 700, 1100, 1600, 2200]
    const timers = attempts.map((delay) =>
      setTimeout(() => {
        if (cancelled) return
        if (probeSafeArea() > 0) {
          // Force every env()-dependent rule to recompute against the now-
          // available value by briefly toggling the attribute they key off.
          document.documentElement.dataset.nativeApp = "false"
          void document.documentElement.offsetHeight
          document.documentElement.dataset.nativeApp = "true"
        }
      }, delay)
    )
    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [])

  useEffect(() => {
    if (!isNativeApp() || status !== "authenticated" || !session?.user?.id) {
      return
    }

    let cancelled = false
    const listeners: CapPluginListener[] = []

    async function cacheUpcoming() {
      try {
        const res = await fetch("/api/reservations?tab=upcoming")
        if (!res.ok) return
        const data = await res.json()
        const list = Array.isArray(data) ? data : data?.reservations
        if (!Array.isArray(list) || cancelled) return
        writeUpcomingCache(
          list.map((r: any) => ({
            id: r.id,
            venueName: r.venue?.name ?? r.venueName ?? null,
            startAt: r.startAt ?? null,
            endAt: r.endAt ?? null,
          }))
        )
      } catch {
        // offline — keep existing cache
      }
    }

    async function registerPush() {
      try {
        const PushNotifications = await getPlugin<{
          requestPermissions: () => Promise<{ receive?: string }>
          register: () => Promise<void>
          addListener: (
            event: string,
            cb: (token: { value: string }) => void
          ) => Promise<CapPluginListener> | CapPluginListener
        }>("PushNotifications")
        if (!PushNotifications) return

        const perm = await PushNotifications.requestPermissions()
        if (perm.receive !== "granted") return
        await PushNotifications.register()

        const handle = await PushNotifications.addListener(
          "registration",
          async (token) => {
            if (cancelled || !token?.value) return
            if (registeredToken.current === token.value) return
            registeredToken.current = token.value
            await fetch("/api/devices/push-token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token: token.value,
                platform: getNativePlatform(),
              }),
            })
          }
        )
        listeners.push(handle)
      } catch (err) {
        console.warn("[native] push registration skipped:", err)
      }
    }

    async function wireDeepLinks() {
      try {
        const App = await getPlugin<{
          addListener: (
            event: string,
            cb: (data: { url: string }) => void
          ) => Promise<CapPluginListener> | CapPluginListener
        }>("App")
        if (!App) return
        const handle = await App.addListener("appUrlOpen", ({ url }) => {
          try {
            const parsed = new URL(url)
            const path =
              parsed.protocol === "nooc:"
                ? `/${parsed.host}${parsed.pathname}`.replace(/\/+/g, "/")
                : parsed.pathname + parsed.search
            if (path && path !== window.location.pathname) {
              window.location.assign(path)
            }
          } catch {
            // ignore malformed
          }
        })
        listeners.push(handle)
      } catch {
        // plugin unavailable
      }
    }

    cacheUpcoming()
    registerPush()
    wireDeepLinks()

    return () => {
      cancelled = true
      listeners.forEach((l) => {
        try {
          void l.remove()
        } catch {
          // ignore
        }
      })
    }
  }, [session?.user?.id, status])

  return null
}
