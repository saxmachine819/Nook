"use client"

import React from "react"
import type { OpenStatus } from "@/lib/hours"

interface VenueHoursDisplayProps {
  /** From getOpenStatus(canonical, now); required for display. No raw Google payload. */
  openStatus: OpenStatus | null
  /** From formatWeeklyHoursFromCanonical(canonical). */
  weeklyFormatted: string[]
}

export function VenueHoursDisplay({ openStatus, weeklyFormatted }: VenueHoursDisplayProps) {
  const hasHours = weeklyFormatted.length > 0
  const isOpen = openStatus?.isOpen ?? false
  const canDetermine = openStatus != null
  const todaysHours = openStatus?.todayHoursText ?? null

  if (!hasHours && !openStatus) {
    return null
  }

  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground">Hours</div>
        {canDetermine && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              isOpen
                ? "bg-emerald-50 text-emerald-700"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {isOpen ? "Open now" : "Closed now"}
          </span>
        )}
      </div>
      {todaysHours && (
        <p className="mb-2 text-sm font-medium">{todaysHours}</p>
      )}
      {weeklyFormatted.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            View weekly hours
          </summary>
          <div className="mt-2 space-y-1">
            {weeklyFormatted.map((dayHours, index) => (
              <div key={index} className="text-xs text-muted-foreground">
                {dayHours}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
