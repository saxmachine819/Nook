"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { safeGet, safeSet } from "@/lib/storage"
import { cn } from "@/lib/utils"

const SEEN_KEY = "nooc_seen_explorer_v1"
const PROMPTED_KEY = "nooc_location_prompted_v1"

type LocationState = "idle" | "requesting" | "granted" | "denied" | "unavailable"

interface ExploreWelcomeBannerProps {
  onUseLocation: () => void
  locationState?: LocationState
}

export function ExploreWelcomeBanner({
  onUseLocation,
  locationState = "idle",
}: ExploreWelcomeBannerProps) {
  const [visible, setVisible] = useState(false)
  const [sessionDismissed, setSessionDismissed] = useState(false)
  const [hasClickedCta, setHasClickedCta] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    if (sessionDismissed) {
      setVisible(false)
      return
    }
    const seen = safeGet(SEEN_KEY)
    setVisible(seen !== "true")
  }, [mounted, sessionDismissed])

  const handleDismiss = () => {
    safeSet(SEEN_KEY, "true")
    setSessionDismissed(true)
    setVisible(false)
  }

  const handleUseLocation = () => {
    setHasClickedCta(true)
    safeSet(PROMPTED_KEY, "true")
    handleDismiss()
    onUseLocation()
  }

  const showLocationError =
    hasClickedCta && (locationState === "denied" || locationState === "unavailable")

  if (!visible || !mounted) return null

  return (
    <div
      className={cn(
        "fixed left-1/2 top-1/2 z-[100] w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[2rem] glass px-8 py-10 shadow-2xl overflow-hidden",
        "animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-500 ease-out"
      )}
    >
      <div className="absolute top-0 right-0 h-32 w-32 -translate-y-1/2 translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-4 right-4 rounded-full glass p-2 text-muted-foreground hover:bg-black/5 hover:text-foreground transition-all duration-300 active:scale-90"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="relative z-10 flex flex-col items-center justify-center text-center gap-6">
        <div className="space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4 animate-bounce-slow">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground/90">
            Find your perfect nook
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed px-2">
            Discover nearby cafés and workspaces. Book a spot in seconds and get focused.
          </p>
        </div>

        <div className="w-full space-y-3">
          <Button
            type="button"
            size="lg"
            onClick={handleUseLocation}
            disabled={locationState === "requesting"}
            className="w-full rounded-2xl font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {locationState === "requesting" ? "Finding you…" : "Use my location"}
          </Button>

          {showLocationError && (
            <p className="text-xs text-muted-foreground/80 font-medium animate-in fade-in slide-in-from-top-1">
              Location access is off. You can still search manually.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

