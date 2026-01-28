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
  const hasDraggedRef = useRef(false) // Track if a drag occurred to prevent toggle button click
  const userManuallyClosedRef = useRef(false) // Track if user manually closed to prevent autoExpand from reopening

  // Auto-expand when search/filters are active
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b5111244-c4ed-4ea6-9398-28181fe79047',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ResultsDrawer.tsx:44',message:'autoExpand useEffect triggered',data:{autoExpand,expanded,isDragging,userManuallyClosed:userManuallyClosedRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix2',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    // Don't auto-expand if user manually closed it or if currently dragging
    if (autoExpand && !expanded && !isDragging && !userManuallyClosedRef.current) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b5111244-c4ed-4ea6-9398-28181fe79047',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ResultsDrawer.tsx:50',message:'autoExpand setting expanded to true',data:{autoExpand,expanded},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix2',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      setExpanded(true)
    }
    // Reset manual close flag when autoExpand becomes false (filters cleared)
    if (!autoExpand) {
      userManuallyClosedRef.current = false
    }
  }, [autoExpand, expanded, isDragging])

  // Calculate height needed based on content
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b5111244-c4ed-4ea6-9398-28181fe79047',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ResultsDrawer.tsx:51',message:'calculatedHeight useEffect triggered',data:{expanded,isDragging,hasContentRef:!!contentRef.current,currentCalculatedHeight:calculatedHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
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
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b5111244-c4ed-4ea6-9398-28181fe79047',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ResultsDrawer.tsx:64',message:'calculatedHeight useEffect - setting new height',data:{contentHeight,totalHeight,maxHeight,finalHeight,previousCalculatedHeight:calculatedHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
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

  const toggle = () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b5111244-c4ed-4ea6-9398-28181fe79047',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ResultsDrawer.tsx:82',message:'toggle called',data:{currentExpanded:expanded,isDragging,hasDragged:hasDraggedRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    // Prevent toggle if a drag just occurred (user released drag on the button)
    if (hasDraggedRef.current) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b5111244-c4ed-4ea6-9398-28181fe79047',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ResultsDrawer.tsx:88',message:'toggle prevented - drag occurred',data:{hasDragged:hasDraggedRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b5111244-c4ed-4ea6-9398-28181fe79047',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ResultsDrawer.tsx:95',message:'toggle executing - flipping expanded state',data:{currentExpanded:expanded,willBeExpanded:!expanded},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    setExpanded((e) => !e)
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return // Only handle left mouse button
    e.preventDefault()
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b5111244-c4ed-4ea6-9398-28181fe79047',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ResultsDrawer.tsx:84',message:'handlePointerDown called',data:{expanded,calculatedHeight,isDragging},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    hasDraggedRef.current = false // Reset drag flag on new drag start
    setIsDragging(true)
    dragStartYRef.current = e.clientY
    const viewportHeight = window.innerHeight
    const currentHeightPx = expanded
      ? (calculatedHeight ?? (viewportHeight * EXPANDED_HEIGHT_PERCENT) / 100)
      : COLLAPSED_HEIGHT
    dragStartHeightRef.current = currentHeightPx
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b5111244-c4ed-4ea6-9398-28181fe79047',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ResultsDrawer.tsx:93',message:'handlePointerDown - drag start values',data:{dragStartY:e.clientY,currentHeightPx,dragStartHeightRef:dragStartHeightRef.current,expanded},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (e.target instanceof HTMLElement) {
      e.target.setPointerCapture(e.pointerId)
    }
  }

  useEffect(() => {
    if (!isDragging) return

    const handlePointerMove = (e: PointerEvent) => {
      if (dragStartYRef.current === null || dragStartHeightRef.current === null) return

      const deltaY = dragStartYRef.current - e.clientY // Positive = dragging up
      // Mark that a drag has occurred if movement is significant
      if (Math.abs(deltaY) > 5) {
        hasDraggedRef.current = true
      }
      
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

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b5111244-c4ed-4ea6-9398-28181fe79047',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ResultsDrawer.tsx:102',message:'handlePointerMove',data:{deltaY,newHeight,dragStartHeightRef:dragStartHeightRef.current,expanded,hasDragged:hasDraggedRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      setDragHeight(newHeight)
    }

    const handlePointerUp = (e: PointerEvent) => {
      const deltaY = dragStartYRef.current !== null ? dragStartYRef.current - e.clientY : 0
      const shouldExpand = Math.abs(deltaY) > DRAG_THRESHOLD
        ? deltaY > 0 // Dragged up = expand
        : expanded // Keep current state if drag was too small

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b5111244-c4ed-4ea6-9398-28181fe79047',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ResultsDrawer.tsx:121',message:'handlePointerUp - before state update',data:{deltaY,absDeltaY:Math.abs(deltaY),DRAG_THRESHOLD,shouldExpand,expanded,dragHeight,calculatedHeight,hasDragged:hasDraggedRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix2',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // Prevent any click events from firing after drag
      if (hasDraggedRef.current) {
        e.preventDefault()
        e.stopPropagation()
      }
      
      // Track if user manually closed (dragged down to collapse)
      if (hasDraggedRef.current && !shouldExpand && expanded) {
        userManuallyClosedRef.current = true
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/b5111244-c4ed-4ea6-9398-28181fe79047',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ResultsDrawer.tsx:131',message:'User manually closed drawer',data:{shouldExpand,expanded},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix2',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
      }
      
      setExpanded(shouldExpand)
      setIsDragging(false)
      setDragHeight(null)
      dragStartYRef.current = null
      dragStartHeightRef.current = null
      // Reset drag flag after a longer delay to ensure toggle button click is prevented
      setTimeout(() => {
        hasDraggedRef.current = false
      }, 300)
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b5111244-c4ed-4ea6-9398-28181fe79047',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ResultsDrawer.tsx:142',message:'handlePointerUp - after state update',data:{shouldExpand,hasDragged:hasDraggedRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix2',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
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
            onClick={(e) => {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/b5111244-c4ed-4ea6-9398-28181fe79047',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ResultsDrawer.tsx:194',message:'toggle button onClick handler called',data:{hasDragged:hasDraggedRef.current,expanded,isDragging},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch(()=>{});
              // #endregion
              e.preventDefault()
              e.stopPropagation()
              if (hasDraggedRef.current) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/b5111244-c4ed-4ea6-9398-28181fe79047',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ResultsDrawer.tsx:201',message:'toggle button click prevented - drag occurred',data:{hasDragged:hasDraggedRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch(()=>{});
                // #endregion
                return
              }
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
        style={{ touchAction: "pan-y" }}
      >
        {venues.length === 0 && favoritesOnly ? (
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
                      className="flex flex-1 gap-3 text-left"
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
                    {/* Heart icon */}
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
