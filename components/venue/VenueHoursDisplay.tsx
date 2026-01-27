"use client"

import { useMemo } from "react"
import { parseGoogleHours, isVenueOpenNow, getTodaysHours } from "@/lib/venue-hours"

interface VenueHoursDisplayProps {
  openingHoursJson: any
}

export function VenueHoursDisplay({ openingHoursJson }: VenueHoursDisplayProps) {
  const { formatted, hasHours } = useMemo(() => parseGoogleHours(openingHoursJson), [openingHoursJson])
  const { isOpen, canDetermine } = useMemo(() => isVenueOpenNow(openingHoursJson), [openingHoursJson])
  const todaysHours = useMemo(() => getTodaysHours(openingHoursJson), [openingHoursJson])

  if (!hasHours) {
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
      <details className="group">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
          View weekly hours
        </summary>
        <div className="mt-2 space-y-1">
          {formatted.map((dayHours, index) => (
            <div key={index} className="text-xs text-muted-foreground">
              {dayHours}
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
