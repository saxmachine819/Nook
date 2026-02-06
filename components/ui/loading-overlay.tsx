"use client"

import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

interface LoadingOverlayProps {
  label?: string
  className?: string
  zIndex?: number
  /** When true, portal a 80% transparent backdrop behind the spinner (for route loading). */
  backdrop?: boolean
}

export function LoadingOverlay({ label, className, zIndex = 50, backdrop = false }: LoadingOverlayProps) {
  const overlay = (
    <div
      className={cn(
        "fixed inset-0 flex items-center justify-center pointer-events-none",
        className
      )}
      style={{ zIndex }}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-3">
        <LoadingSpinner size="md" />
        {label && (
          <p className="text-sm text-muted-foreground">{label}</p>
        )}
      </div>
    </div>
  )

  const content = backdrop ? (
    <>
      <div className="fixed inset-0 z-[10] bg-background/20" aria-hidden="true" />
      {overlay}
    </>
  ) : overlay

  if (typeof document !== "undefined") {
    return createPortal(content, document.body)
  }

  return content
}
