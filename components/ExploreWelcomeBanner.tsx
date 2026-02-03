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
        "fixed left-1/2 top-1/2 z-20 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background px-5 py-4 shadow-lg",
        "animate-in fade-in zoom-in-95 duration-150"
      )}
    >
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-3 right-3 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex flex-col items-center justify-center text-center gap-3 pr-8">
        <div className="text-center">
          <h2 className="font-semibold text-foreground">
            Reserve a seat or table to work
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Find a nearby café, book a spot, and show up.
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 shrink-0">
          <Button
            type="button"
            size="sm"
            onClick={handleUseLocation}
            disabled={locationState === "requesting"}
          >
            {locationState === "requesting" ? "Getting location…" : "Use my location"}
          </Button>
          {showLocationError && (
            <p className="text-xs text-muted-foreground text-center">
              Location access is off. You can still search by neighborhood.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
