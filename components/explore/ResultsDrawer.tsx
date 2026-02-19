"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { FavoriteButton } from "@/components/venue/FavoriteButton"
import { Button } from "@/components/ui/button"

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
  isLoading?: boolean
  /** Initial load - pins haven't loaded yet */
  isInitialLoading?: boolean
  total?: number
  onSelectVenue: (id: string) => void
  onCenterOnVenue?: (id: string) => void
  autoExpand?: boolean
  favoritesOnly?: boolean
  onClearFavoritesFilter?: () => void
  favoritedVenueIds?: Set<string>
  onToggleFavorite?: (venueId: string, favorited: boolean) => void
  /** When true, user is searching/filtering (not browsing map) */
  isSearchMode?: boolean
  /** Current search query text */
  searchQuery?: string
}

function VenueCardSkeleton() {
  return (
    <div className="flex w-full gap-3 rounded-lg border border-border bg-card p-3 animate-pulse">
      <div className="h-16 w-16 shrink-0 rounded-md bg-muted" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
        <div className="h-3 w-1/3 rounded bg-muted" />
      </div>
    </div>
  )
}

export function ResultsDrawer({
  venues,
  isLoading = false,
  isInitialLoading = false,
  total,
  onSelectVenue,
  onCenterOnVenue,
  autoExpand = false,
  favoritesOnly = false,
  onClearFavoritesFilter,
  favoritedVenueIds = new Set(),
  onToggleFavorite,
  isSearchMode = false,
  searchQuery = "",
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
  }, [expanded, venues.length, isLoading, isDragging])

  const displayCount = total ?? venues.length

  // Different labels for search mode vs browse mode
  const getLabel = () => {
    // Initial loading - no data yet
    if (isInitialLoading) {
      return "Finding venues nearby…"
    }

    if (isSearchMode) {
      // Search/filter mode - show searching or results
      if (isLoading) {
        return searchQuery ? `Searching "${searchQuery}"…` : "Searching…"
      }
      if (displayCount === 0) {
        return searchQuery ? `No results for "${searchQuery}"` : "No results"
      }
      return displayCount === 1 ? "1 result" : `${displayCount} results`
    }

    // Browse mode - use pins total
    const hasCount = total != null && total > 0
    if (!hasCount && isLoading) {
      return "Loading…"
    }
    return displayCount === 1
      ? "1 location in this area"
      : `${displayCount} locations in this area`
  }

  const label = getLabel()

  const showLoadingContent = isLoading || isInitialLoading

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
        "fixed left-0 right-0 flex flex-col rounded-t-[2.5rem] glass shadow-2xl overflow-hidden px-1",
        "bottom-[5.5rem]",
        isDragging && "transition-none",
        !isDragging && "transition-[height] duration-500 ease-smooth-out"
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
      <div className={cn("flex flex-col shrink-0 pointer-events-none transition-all duration-300", isExpandedOrDraggingUp ? "pt-2 pb-1" : "pt-2 pb-3")}>
        <div
          onPointerDown={handlePointerDown}
          onClick={() => {
            if (hasDraggedRef.current) return
            toggle()
          }}
          className="pointer-events-auto flex w-full max-w-sm mx-auto flex-col items-center gap-2 touch-none cursor-grab active:cursor-grabbing select-none"
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
          <div className="h-1.5 w-12 shrink-0 rounded-full bg-primary/20 backdrop-blur-sm" aria-hidden />
          <span className="text-[11px] font-bold uppercase tracking-wider text-primary/70 touch-manipulation">
            {label}
          </span>
        </div>
      </div>
      <div
        ref={contentRef}
        className={cn(
          "flex-1 overflow-y-auto overscroll-contain px-5 pb-10 min-h-0",
          !isExpandedOrDraggingUp && "hidden"
        )}
        style={{ touchAction: "pan-y", pointerEvents: "auto" }}
      >
        {/* Loading state */}
        {showLoadingContent ? (
          <ul className="space-y-4 pt-2">
            {Array.from({ length: Math.min(displayCount || 3, 5) }).map((_, i) => (
              <li key={i}>
                <VenueCardSkeleton />
              </li>
            ))}
          </ul>
        ) : venues.length === 0 && favoritesOnly ? (
          <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in zoom-in duration-500">
            <div className="h-20 w-20 rounded-full bg-primary/5 flex items-center justify-center mb-6">
              <svg className="h-10 w-10 text-primary/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <p className="text-base font-bold text-foreground/80 mb-2">Your favorites list is empty</p>
            <p className="text-sm text-muted-foreground/70 mb-8 max-w-[200px]">
              Save the spots you love to find them again quickly.
            </p>
            {onClearFavoritesFilter && (
              <Button
                variant="outline"
                onClick={onClearFavoritesFilter}
                className="rounded-2xl font-bold px-8 border-none bg-primary/5 text-primary hover:bg-primary/10"
              >
                Start Exploring
              </Button>
            )}
          </div>
        ) : venues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-8 animate-in fade-in duration-500">
            <p className="text-sm font-medium text-muted-foreground/80 leading-relaxed">
              {isSearchMode
                ? searchQuery
                  ? `We couldn't find any results for "${searchQuery}". Maybe try a different neighborhood?`
                  : "No venues match your current filters."
                : "No locations in this area yet. Feel free to search a different spot on the map."}
            </p>
          </div>
        ) : (
          <ul className="space-y-4 pt-2">
            {venues.map((venue) => {
              const isFavorited = favoritedVenueIds.has(venue.id)
              return (
                <li key={venue.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both" style={{ animationDelay: `${venues.indexOf(venue) * 50}ms` }}>
                  <div className="relative group rounded-3xl border border-white/40 bg-white/40 p-3.5 shadow-sm transition-all duration-300 hover:premium-shadow hover:bg-white/80 active:scale-[0.98]">
                    {/* Heart - absolutely positioned so it always receives clicks and is never overlapped by the tap area */}
                    <div
                      className="absolute top-3 right-3 z-20 touch-manipulation"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <FavoriteButton
                        type="venue"
                        itemId={venue.id}
                        initialFavorited={isFavorited}
                        size="sm"
                        className="rounded-full bg-white/50 p-2 shadow-sm transition-all active:scale-95"
                        onToggle={(favorited) => {
                          if (onToggleFavorite) {
                            onToggleFavorite(venue.id, favorited)
                          }
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleVenueTap(venue.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          handleVenueTap(venue.id)
                        }
                      }}
                      className="flex w-full gap-4 text-left min-w-0 cursor-pointer pr-10"
                    >
                      {venue.imageUrls && venue.imageUrls.length > 0 && (
                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl">
                          <img
                            src={venue.imageUrls[0]}
                            alt={venue.name}
                            className="h-full w-full object-cover object-center"
                          />
                          <div className="absolute inset-0 bg-black/5" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 py-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <p className="font-bold text-base tracking-tight text-foreground/90 group-hover:text-primary transition-colors truncate min-w-0">{venue.name}</p>
                            <p className="shrink-0 text-sm font-bold text-primary flex items-baseline gap-0.5">
                              ${venue.minPrice.toFixed(0)}
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter opacity-50">/ hr</span>
                            </p>
                          </div>
                          {(venue.address || (venue.city && venue.state)) && (
                            <p className="mt-0.5 text-xs font-medium text-muted-foreground/70 truncate flex items-center gap-1">
                              <span className="shrink-0 font-bold opacity-30">·</span> {venue.address || `${venue.city}, ${venue.state}`}
                            </p>
                          )}
                        </div>

                        {venue.availabilityLabel && (
                          <div className="flex items-center gap-2 mt-auto">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/5 px-2 py-0.5 rounded-full">
                              {venue.availabilityLabel}
                            </span>
                          </div>
                        )}
                      </div>
                    </button>
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

