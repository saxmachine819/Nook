"use client"

import { getCapacitor, isNativeApp } from "@/lib/native-app"

async function getPlugin<T = any>(name: string): Promise<T | null> {
  const cap = getCapacitor() as any
  if (!cap) return null
  if (cap.Plugins?.[name]) return cap.Plugins[name] as T
  if (typeof cap.registerPlugin === "function") {
    try {
      return cap.registerPlugin(name) as T
    } catch {
      return null
    }
  }
  return null
}

export async function nativeHapticImpact(
  style: "light" | "medium" | "heavy" = "light"
) {
  if (!isNativeApp()) return
  try {
    const Haptics = await getPlugin<{
      impact: (opts: { style: string }) => Promise<void>
    }>("Haptics")
    await Haptics?.impact?.({ style })
  } catch {
    // ignore
  }
}

export async function nativeShare(opts: {
  title?: string
  text?: string
  url?: string
  dialogTitle?: string
}) {
  if (!isNativeApp()) {
    if (typeof navigator !== "undefined" && navigator.share && opts.url) {
      try {
        await navigator.share({
          title: opts.title,
          text: opts.text,
          url: opts.url,
        })
        return true
      } catch {
        return false
      }
    }
    return false
  }
  try {
    const Share = await getPlugin<{
      share: (opts: {
        title?: string
        text?: string
        url?: string
        dialogTitle?: string
      }) => Promise<unknown>
    }>("Share")
    await Share?.share?.(opts)
    await nativeHapticImpact("light")
    return true
  } catch {
    return false
  }
}

const BIOMETRIC_PREF_KEY = "nooc.biometricUnlock"

export async function getBiometricUnlockEnabled(): Promise<boolean> {
  if (!isNativeApp()) return false
  try {
    const Preferences = await getPlugin<{
      get: (opts: { key: string }) => Promise<{ value: string | null }>
    }>("Preferences")
    const result = await Preferences?.get?.({ key: BIOMETRIC_PREF_KEY })
    return result?.value === "1"
  } catch {
    return false
  }
}

export async function setBiometricUnlockEnabled(enabled: boolean) {
  if (!isNativeApp()) return
  try {
    const Preferences = await getPlugin<{
      set: (opts: { key: string; value: string }) => Promise<void>
    }>("Preferences")
    await Preferences?.set?.({
      key: BIOMETRIC_PREF_KEY,
      value: enabled ? "1" : "0",
    })
  } catch {
    // ignore
  }
}
