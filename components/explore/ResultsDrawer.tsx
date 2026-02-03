"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { FavoriteButton } from "@/components/venue/FavoriteButton"

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
  isSearchingText?: boolean
  onSelectVenue: (id: string) => void
  onCenterOnVenue?: (id: string) => void
  autoExpand?: boolean // Automatically expand when search/filters are active
  favoritesOnly?: boolean
  onClearFavoritesFilter?: () => void
  favoritedVenueIds?: Set<string>
  onToggleFavorite?: (venueId: string, favorited: boolean) => void
}

export function ResultsDrawer({
  venues,
  isSearchingText = false,
  onSelectVenue,
  onCenterOnVenue,
  autoExpand = false,
  favoritesOnly = false,
  onClearFavoritesFilter,
  favoritedVenueIds = new Set(),
  onToggleFavorite,
}: ResultsDrawerProps) {
  const [expanded, setExpanded] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const dragStartYRef = useRef<number | null>(null)
  const dragStartHeightRef = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [calculatedHeight, setCalculatedHeight] = useState<number | null>(null)
  const hasDraggedRef = useRef(false)
  const userManuallyClosedRef = useRef(false)

  // Auto-expand when search/filters are active
  useEffect(() => {
    if (autoExpand && !expanded && !isDragging && !userManuallyClosedRef.current) {
      setExpanded(true)
    }
    if (!autoExpand) {
      userManuallyClosedRef.current = false
    }
  }, [autoExpand, expanded, isDragging])

  // Calculate height needed based on content
  useEffect(() => {
    if (expanded && contentRef.current && !isDragging) {
      const contentHeight = contentRef.current.scrollHeight
      const headerHeight = 48
      const padding = 16 + 24
      const totalHeight = headerHeight + contentHeight + padding
      const viewportHeight = window.innerHeight
      const maxHeight = (viewportHeight * 60) / 100
      setCalculatedHeight(Math.min(totalHeight, maxHeight))
    } else if (!expanded) {
      setCalculatedHeight(null)
    }
  }, [expanded, venues.length, isSearchingText, isDragging])

  const n = venues.length
  const label = isSearchingText ? "Searching…" : n === 1 ? "1 location in this area" : `${n} locations in this area`

  const COLLAPSED_HEIGHT = 48
  const EXPANDED_HEIGHT_PERCENT = 60
  const DRAG_THRESHOLD = 50

  const handleVenueTap = (id: string) => {
    onSelectVenue(id)
    onCenterOnVenue?.(id)
  }

  const toggle = () => {
    if (hasDraggedRef.current) return
    setExpanded((prev) => {
      if (prev) userManuallyClosedRef.current = true
      return !prev
    })
  }

  // Drag handle: only for touch so mouse clicks on list items still work
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return
    if (e.button !== 0) return
    e.preventDefault()
    hasDraggedRef.current = false
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
      const deltaY = dragStartYRef.current - e.clientY
      if (Math.abs(deltaY) > 5) hasDraggedRef.current = true
      const viewportHeight = window.innerHeight
      const expandedHeightPx = (viewportHeight * EXPANDED_HEIGHT_PERCENT) / 100
      let newHeight: number
      if (dragStartHeightRef.current === COLLAPSED_HEIGHT) {
        newHeight = Math.max(COLLAPSED_HEIGHT, Math.min(expandedHeightPx, COLLAPSED_HEIGHT + deltaY))
      } else {
        newHeight = Math.max(COLLAPSED_HEIGHT, Math.min(expandedHeightPx, dragStartHeightRef.current + deltaY))
      }
      setDragHeight(newHeight)
    }

    const handlePointerUp = (e: PointerEvent) => {
      const deltaY = dragStartYRef.current !== null ? dragStartYRef.current - e.clientY : 0
      const shouldExpand = Math.abs(deltaY) > DRAG_THRESHOLD
        ? deltaY > 0
        : expanded
      if (hasDraggedRef.current) {
        e.preventDefault()
        e.stopPropagation()
      }
      if (hasDraggedRef.current && !shouldExpand && expanded) {
        userManuallyClosedRef.current = true
      }
      setExpanded(shouldExpand)
      setIsDragging(false)
      setDragHeight(null)
      dragStartYRef.current = null
      dragStartHeightRef.current = null
      setTimeout(() => { hasDraggedRef.current = false }, 300)
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [isDragging, expanded])

  const currentHeight =
    dragHeight !== null
      ? dragHeight
      : expanded
        ? (calculatedHeight ?? undefined)
        : COLLAPSED_HEIGHT

  const isExpandedOrDraggingUp = expanded || (dragHeight !== null && dragHeight > COLLAPSED_HEIGHT + 20)

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed left-0 right-0 flex flex-col rounded-t-xl border-t border-border bg-background shadow-lg",
        "bottom-[5rem]",
        isDragging && "transition-none",
        !isDragging && "transition-[height] duration-300 ease-in-out"
      )}
      style={{
        zIndex: 100,
        pointerEvents: "auto",
        height: currentHeight !== undefined ? `${currentHeight}px` : undefined,
        ...(currentHeight === undefined && expanded && calculatedHeight === null
          ? { height: "60vh", maxHeight: "calc(100vh - 5rem)" }
          : {}),
      }}
    >
      <div className={cn("flex flex-col shrink-0 pointer-events-none", isExpandedOrDraggingUp ? "pt-1 pb-0" : "pt-1.5 pb-1.5")}>
        <div
          onPointerDown={handlePointerDown}
          className="pointer-events-auto flex w-full max-w-sm mx-auto flex-col items-center gap-1 touch-none cursor-grab active:cursor-grabbing select-none"
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
          <div className="h-1 w-12 shrink-0 rounded-full bg-foreground/40" aria-hidden />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (hasDraggedRef.current) return
              toggle()
            }}
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
        style={{ touchAction: "pan-y", pointerEvents: "auto" }}
      >
        {isSearchingText ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground">Searching…</p>
          </div>
        ) : venues.length === 0 && favoritesOnly ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm font-medium text-foreground mb-2">No favorites yet.</p>
            <p className="text-xs text-muted-foreground mb-4">
              Start favoriting venues to see them here.
            </p>
            {onClearFavoritesFilter && (
              <button
                type="button"
                onClick={onClearFavoritesFilter}
                className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                Browse venues
              </button>
            )}
          </div>
        ) : venues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <p className="text-sm text-muted-foreground">
              No locations in this area. Tap &quot;Search this area&quot; on the map to search.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {venues.map((venue) => {
              const isFavorited = favoritedVenueIds.has(venue.id)
              return (
                <li key={venue.id}>
                  <div className="relative flex w-full gap-3 rounded-lg border border-border bg-card p-3 shadow-sm transition-colors hover:bg-accent/50">
                    <button
                      type="button"
                      onClick={() => handleVenueTap(venue.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          handleVenueTap(venue.id)
                        }
                      }}
                      className="flex flex-1 gap-3 text-left min-w-0 cursor-pointer"
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
                    {/* Heart icon - stop propagation so clicking heart doesn't open card */}
                    <div
                      className="flex items-start pt-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FavoriteButton
                        type="venue"
                        itemId={venue.id}
                        initialFavorited={isFavorited}
                        size="sm"
                        className="shrink-0"
                        onToggle={(favorited) => {
                          if (onToggleFavorite) {
                            onToggleFavorite(venue.id, favorited)
                          }
                        }}
                      />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
