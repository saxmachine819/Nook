"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

export interface ResultsDrawerVenue {
  id: string
  name: string
  address?: string
  city?: string
  state?: string
  latitude: number | null
  longitude: number | null
  minPrice: number
  maxPrice: number
  tags: string[]
  availabilityLabel?: string
  imageUrls?: string[]
}

interface ResultsDrawerProps {
  venues: ResultsDrawerVenue[]
  onSelectVenue: (id: string) => void
  onCenterOnVenue?: (id: string) => void
  autoExpand?: boolean // Automatically expand when search/filters are active
}

export function ResultsDrawer({
  venues,
  onSelectVenue,
  onCenterOnVenue,
  autoExpand = false,
}: ResultsDrawerProps) {
  const [expanded, setExpanded] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const dragStartYRef = useRef<number | null>(null)
  const dragStartHeightRef = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [calculatedHeight, setCalculatedHeight] = useState<number | null>(null)

  // Auto-expand when search/filters are active
  useEffect(() => {
    if (autoExpand && !expanded) {
      setExpanded(true)
    }
  }, [autoExpand, expanded])

  // Calculate height needed based on content
  useEffect(() => {
    if (expanded && contentRef.current && !isDragging) {
      // Measure the actual content height
      const contentHeight = contentRef.current.scrollHeight
      const headerHeight = 48 // COLLAPSED_HEIGHT
      const padding = 16 + 24 // px-4 (16px) + pb-6 (24px)
      const totalHeight = headerHeight + contentHeight + padding
      
      // Cap at max height (60vh)
      const viewportHeight = window.innerHeight
      const maxHeight = (viewportHeight * 60) / 100
      const finalHeight = Math.min(totalHeight, maxHeight)
      
      setCalculatedHeight(finalHeight)
    } else if (!expanded) {
      setCalculatedHeight(null)
    }
  }, [expanded, venues.length, isDragging])

  const n = venues.length
  const label = n === 1 ? "1 location in this area" : `${n} locations in this area`

  const COLLAPSED_HEIGHT = 48
  const EXPANDED_HEIGHT_PERCENT = 60 // 60vh
  const DRAG_THRESHOLD = 50 // pixels to trigger expand/collapse

  const handleVenueTap = (id: string) => {
    onSelectVenue(id)
    onCenterOnVenue?.(id)
  }

  const toggle = () => setExpanded((e) => !e)

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return // Only handle left mouse button
    e.preventDefault()
    setIsDragging(true)
    dragStartYRef.current = e.clientY
    const viewportHeight = window.innerHeight
    const currentHeightPx = expanded
      ? (calculatedHeight ?? (viewportHeight * EXPANDED_HEIGHT_PERCENT) / 100)
      : COLLAPSED_HEIGHT
    dragStartHeightRef.current = currentHeightPx
    if (e.target instanceof HTMLElement) {
      e.target.setPointerCapture(e.pointerId)
    }
  }

  useEffect(() => {
    if (!isDragging) return

    const handlePointerMove = (e: PointerEvent) => {
      if (dragStartYRef.current === null || dragStartHeightRef.current === null) return

      const deltaY = dragStartYRef.current - e.clientY // Positive = dragging up
      const viewportHeight = window.innerHeight
      const expandedHeightPx = (viewportHeight * EXPANDED_HEIGHT_PERCENT) / 100

      let newHeight: number
      if (dragStartHeightRef.current === COLLAPSED_HEIGHT) {
        // Dragging from collapsed
        newHeight = Math.max(COLLAPSED_HEIGHT, Math.min(expandedHeightPx, COLLAPSED_HEIGHT + deltaY))
      } else {
        // Dragging from expanded
        newHeight = Math.max(COLLAPSED_HEIGHT, Math.min(expandedHeightPx, dragStartHeightRef.current + deltaY))
      }

      setDragHeight(newHeight)
    }

    const handlePointerUp = (e: PointerEvent) => {
      const deltaY = dragStartYRef.current !== null ? dragStartYRef.current - e.clientY : 0
      const shouldExpand = Math.abs(deltaY) > DRAG_THRESHOLD
        ? deltaY > 0 // Dragged up = expand
        : expanded // Keep current state if drag was too small

      setExpanded(shouldExpand)
      setIsDragging(false)
      setDragHeight(null)
      dragStartYRef.current = null
      dragStartHeightRef.current = null
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [isDragging, expanded])

  const currentHeight = dragHeight !== null
    ? dragHeight
    : expanded
    ? (calculatedHeight ?? undefined) // Use calculated height when expanded
    : COLLAPSED_HEIGHT

  const isExpandedOrDraggingUp = expanded || (dragHeight !== null && dragHeight > COLLAPSED_HEIGHT + 20)

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed left-0 right-0 z-40 flex flex-col rounded-t-xl border-t border-border bg-background shadow-lg",
        "bottom-[5rem]",
        isDragging && "transition-none", // Disable transition during drag
        !isDragging && "transition-[height] duration-300 ease-in-out" // Warmer, more premium feel
      )}
      style={{
        height: currentHeight !== undefined ? `${currentHeight}px` : undefined,
        ...(currentHeight === undefined && expanded && calculatedHeight === null
          ? { height: "60vh", maxHeight: "calc(100vh - 5rem)" }
          : {}),
      }}
    >
      <div className={cn("flex flex-col shrink-0", isExpandedOrDraggingUp ? "pt-1 pb-0" : "pt-1.5 pb-1.5")}>
        <div
          onPointerDown={handlePointerDown}
          className="flex w-full flex-col items-center gap-1 touch-none cursor-grab active:cursor-grabbing select-none"
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse list — drag down" : "Expand list — drag up or tap"}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              toggle()
            }
          }}
        >
          <div
            className="h-1 w-12 shrink-0 rounded-full bg-foreground/40"
            aria-hidden
          />
          <button
            type="button"
            onClick={toggle}
            className="text-xs font-medium text-foreground touch-manipulation"
            aria-hidden="true"
            tabIndex={-1}
          >
            {label}
          </button>
        </div>
      </div>
      <div
        ref={contentRef}
        className={cn(
          "flex-1 overflow-y-auto overscroll-contain px-4 pb-6 min-h-0",
          !isExpandedOrDraggingUp && "hidden"
        )}
        style={{ touchAction: "pan-y" }}
      >
        <ul className="space-y-2">
          {venues.map((venue) => (
            <li key={venue.id}>
              <button
                type="button"
                onClick={() => handleVenueTap(venue.id)}
                className="flex w-full gap-3 rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-colors hover:bg-accent/50 active:bg-accent"
              >
                {venue.imageUrls && venue.imageUrls.length > 0 && (
                  <img
                    src={venue.imageUrls[0]}
                    alt={venue.name}
                    className="h-16 w-16 shrink-0 rounded-md object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold leading-tight text-foreground">{venue.name}</p>
                  {(venue.address || (venue.city && venue.state)) && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {venue.address || `${venue.city}, ${venue.state}`}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {venue.minPrice === venue.maxPrice
                      ? `$${venue.minPrice.toFixed(0)} / seat / hour`
                      : `$${venue.minPrice.toFixed(0)}–$${venue.maxPrice.toFixed(0)} / seat / hour`}
                  </p>
                  {venue.availabilityLabel && (
                    <p className="mt-1 text-xs font-medium text-primary">
                      {venue.availabilityLabel}
                    </p>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
