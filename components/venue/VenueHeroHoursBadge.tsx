"use client"

import React from "react"
import type { OpenStatus } from "@/lib/hours"

interface VenueHeroHoursBadgeProps {
  openStatus: OpenStatus | null
  weeklyFormatted: string[]
}

export function VenueHeroHoursBadge({
  openStatus,
  weeklyFormatted,
}: VenueHeroHoursBadgeProps) {
  const hasHours = weeklyFormatted.length > 0
  const isOpen = openStatus?.isOpen ?? false
  const statusLabel = openStatus != null ? (isOpen ? "Open" : "Closed") : null

  if (!statusLabel && !hasHours) {
    return null
  }

  return (
    <div className="absolute top-6 left-6 z-10">
      <details className="group relative">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full glass px-4 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-primary shadow-lg transition-opacity hover:opacity-90 [&::-webkit-details-marker]:hidden">
          <span>{statusLabel ?? "Hours"}</span>
          {hasHours && (
            <span className="flex-shrink-0 transition-transform duration-200 group-open:rotate-180">
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-80">
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          )}
        </summary>
        {hasHours && (
          <div className="absolute top-full left-0 mt-1.5 min-w-[14rem] max-w-[min(100vw,24rem)] rounded-2xl border border-border/50 bg-background/95 py-3 px-4 shadow-xl backdrop-blur-sm z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="space-y-1.5">
              {weeklyFormatted.map((dayHours, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center gap-4 border-b border-primary/5 pb-2 text-xs font-bold last:border-0 last:pb-0"
                >
                  {dayHours.split(": ").map((part, i) => (
                    <span
                      key={i}
                      className={i === 0 ? "text-primary/40 uppercase tracking-widest text-[9px]" : "text-foreground/70"}
                    >
                      {part}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </details>
    </div>
  )
}
