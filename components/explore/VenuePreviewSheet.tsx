"use client"

import { useEffect, useState } from "react"
import { VenueCard } from "@/components/venue/VenueCard"
import { cn } from "@/lib/utils"

export interface VenuePreviewSheetVenue {
  id: string
  name: string
  address?: string
  city?: string
  state?: string
  minPrice: number
  maxPrice: number
  tags: string[]
  availabilityLabel?: string
  imageUrls?: string[]
  capacity: number
  rulesText?: string
  dealBadge?: {
    title: string
    description: string
    type: string
    summary: string
  } | null
}

interface VenuePreviewSheetProps {
  open: boolean
  venue: VenuePreviewSheetVenue | null
  onClose: () => void
  className?: string
}

const SHEET_TRANSITION_MS = 200

export function VenuePreviewSheet({
  open,
  venue,
  onClose,
  className,
}: VenuePreviewSheetProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
      setVisible(false)
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true))
      })
      return () => {
        cancelAnimationFrame(id)
        document.body.style.overflow = ""
      }
    }
    document.body.style.overflow = ""
    setVisible(false)
  }, [open])


  if (!venue) return null

  return (
    <>
      {/* Backdrop - tap to close */}
      <button
        type="button"
        aria-label="Close venue preview"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/20 ease-out",
          visible ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        style={{ transitionDuration: `${SHEET_TRANSITION_MS}ms`, transitionProperty: "opacity" }}
      />
      {/* Sheet - lands just above bottom nav (5rem); no padding, card full-bleed */}
      <div
        className={cn(
          "fixed left-0 right-0 z-40 rounded-t-xl border-t border-border bg-background shadow-lg",
          "ease-out",
          className
        )}
        style={{
          bottom: "5rem",
          transition: `transform ${SHEET_TRANSITION_MS}ms ease-out`,
          transform: visible ? "translateY(0)" : "translateY(100%)",
        }}
      >
        <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
          <VenueCard
            id={venue.id}
            name={venue.name}
            address={venue.address}
            city={venue.city}
            state={venue.state}
            minPrice={venue.minPrice}
            maxPrice={venue.maxPrice}
            tags={venue.tags}
            availabilityLabel={venue.availabilityLabel}
            imageUrls={venue.imageUrls}
            capacity={venue.capacity}
            rulesText={venue.rulesText}
            isExpanded={false}
            isDeemphasized={false}
            dealBadge={venue.dealBadge}
          />
        </div>
      </div>
    </>
  )
}
