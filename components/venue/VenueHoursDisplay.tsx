"use client"

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
    <div className="rounded-[2rem] bg-primary/[0.03] p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black uppercase tracking-widest text-primary/40">Hours</div>
        {canDetermine && (
          <span
            className={`rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all duration-500 shadow-sm ${isOpen
                ? "bg-emerald-500 text-white shadow-emerald-500/20"
                : "bg-muted text-muted-foreground/60"
              }`}
          >
            {isOpen ? "Open now" : "Closed now"}
          </span>
        )}
      </div>

      {todaysHours && (
        <p className="text-xl font-black tracking-tight text-foreground/80">{todaysHours}</p>
      )}

      {weeklyFormatted.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-primary/60 hover:text-primary transition-colors flex items-center gap-2 list-none">
            <span className="group-open:rotate-180 transition-transform duration-300">
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            View weekly schedule
          </summary>
          <div className="mt-6 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
            {weeklyFormatted.map((dayHours, index) => (
              <div key={index} className="flex justify-between items-center text-xs font-bold text-foreground/60 border-b border-primary/5 pb-2 last:border-0 last:pb-0">
                {dayHours.split(': ').map((part, i) => (
                  <span key={i} className={i === 0 ? "text-primary/40 uppercase tracking-widest text-[9px]" : ""}>
                    {part}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )

}
