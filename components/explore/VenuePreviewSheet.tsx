"use client"

import { useEffect, useRef, useState } from "react"
import { VenueCard } from "@/components/venue/VenueCard"
import { cn } from "@/lib/utils"

const SWIPE_CLOSE_THRESHOLD_PX = 80
const SWIPE_COMMIT_THRESHOLD_PX = 18
const SWIPE_VELOCITY_THRESHOLD_PX_MS = 0.3
const SWIPE_VELOCITY_MIN_DISTANCE_PX = 50

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
  initialSeatCount?: number
  isFavorited?: boolean
  onToggleFavorite?: () => void
}

const SHEET_TRANSITION_MS = 200

export function VenuePreviewSheet({
  open,
  venue,
  onClose,
  className,
  initialSeatCount,
  isFavorited = false,
  onToggleFavorite,
}: VenuePreviewSheetProps) {
  const [visible, setVisible] = useState(false)
  const [dragTranslateY, setDragTranslateY] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef(0)
  const startScrollTopRef = useRef(0)
  const startTimeRef = useRef(0)
  const swipeToCloseActiveRef = useRef(false)
  const currentDeltaYRef = useRef(0)
  const touchGestureActiveRef = useRef(false)
  const pointerDownOnSheetRef = useRef(false)
  const setDragTranslateYRef = useRef<(y: number) => void>(() => {})
  setDragTranslateYRef.current = setDragTranslateY

  const handlePointerDown = (e: React.PointerEvent) => {
    if (touchGestureActiveRef.current) return
    pointerDownOnSheetRef.current = true
    const scrollEl = scrollContainerRef.current
    const startScrollTop = scrollEl ? scrollEl.scrollTop : 0
    startYRef.current = e.clientY
    startScrollTopRef.current = startScrollTop
    startTimeRef.current = Date.now()
    swipeToCloseActiveRef.current = false
    currentDeltaYRef.current = 0
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (touchGestureActiveRef.current) return
    if (!pointerDownOnSheetRef.current) return
    const deltaY = e.clientY - startYRef.current
    if (deltaY <= 0) return
    currentDeltaYRef.current = deltaY
    if (!swipeToCloseActiveRef.current && deltaY > SWIPE_COMMIT_THRESHOLD_PX) {
      swipeToCloseActiveRef.current = true
    }
    if (swipeToCloseActiveRef.current) {
      e.preventDefault()
      setDragTranslateY(deltaY)
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (touchGestureActiveRef.current) return
    pointerDownOnSheetRef.current = false
    const deltaY = currentDeltaYRef.current
    const elapsed = Date.now() - startTimeRef.current
    const velocity = elapsed > 0 ? deltaY / elapsed : 0
    const shouldClose =
      swipeToCloseActiveRef.current &&
      (deltaY >= SWIPE_CLOSE_THRESHOLD_PX ||
        (deltaY >= SWIPE_VELOCITY_MIN_DISTANCE_PX && velocity >= SWIPE_VELOCITY_THRESHOLD_PX_MS))
    if (shouldClose) onClose()
    else setDragTranslateY(0)
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    startYRef.current = 0
    startScrollTopRef.current = 0
    swipeToCloseActiveRef.current = false
    currentDeltaYRef.current = 0
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchGestureActiveRef.current = true
    startYRef.current = e.touches[0].clientY
    startTimeRef.current = Date.now()
    swipeToCloseActiveRef.current = false
    currentDeltaYRef.current = 0
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const deltaY = e.touches[0].clientY - startYRef.current
    if (deltaY <= 0) return
    currentDeltaYRef.current = deltaY
    if (!swipeToCloseActiveRef.current && deltaY > SWIPE_COMMIT_THRESHOLD_PX) {
      swipeToCloseActiveRef.current = true
    }
    if (swipeToCloseActiveRef.current) {
      e.preventDefault()
      setDragTranslateY(deltaY)
    }
  }

  const handleTouchEnd = () => {
    const deltaY = currentDeltaYRef.current
    const elapsed = Date.now() - startTimeRef.current
    const velocity = elapsed > 0 ? deltaY / elapsed : 0
    const shouldClose =
      swipeToCloseActiveRef.current &&
      (deltaY >= SWIPE_CLOSE_THRESHOLD_PX ||
        (deltaY >= SWIPE_VELOCITY_MIN_DISTANCE_PX && velocity >= SWIPE_VELOCITY_THRESHOLD_PX_MS))
    if (shouldClose) onClose()
    else setDragTranslateY(0)
    touchGestureActiveRef.current = false
    startYRef.current = 0
    startScrollTopRef.current = 0
    swipeToCloseActiveRef.current = false
    currentDeltaYRef.current = 0
  }

  // Touchmove needs passive: false for preventDefault to work; React doesn't support that, so add listener imperatively
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return
      const deltaY = e.touches[0].clientY - startYRef.current
      if (deltaY <= 0) return
      currentDeltaYRef.current = deltaY
      if (!swipeToCloseActiveRef.current && deltaY > SWIPE_COMMIT_THRESHOLD_PX) {
        swipeToCloseActiveRef.current = true
      }
      if (swipeToCloseActiveRef.current) {
        e.preventDefault()
        setDragTranslateYRef.current(deltaY)
      }
    }
    el.addEventListener("touchmove", onTouchMove, { passive: false })
    return () => el.removeEventListener("touchmove", onTouchMove)
  }, [])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
      setVisible(false)
      setDragTranslateY(0)
      pointerDownOnSheetRef.current = false
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
    setDragTranslateY(0)
    pointerDownOnSheetRef.current = false
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
        data-testid="venue-preview-sheet"
        className={cn(
          "fixed left-0 right-0 z-40 rounded-t-xl border-t border-border bg-background shadow-lg",
          "ease-out",
          className
        )}
        style={{
          bottom: "5rem",
          transition: dragTranslateY > 0 ? "none" : `transform ${SHEET_TRANSITION_MS}ms ease-out`,
          transform: visible
            ? (dragTranslateY > 0 ? `translateY(${dragTranslateY}px)` : "translateY(0)")
            : "translateY(100%)",
        }}
      >
        <div
          ref={scrollContainerRef}
          data-testid="venue-preview-sheet-scroll"
          className="max-h-[60vh] overflow-y-auto overscroll-contain"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <VenueCard
            key={`${venue.id}-${initialSeatCount ?? 'default'}`} // Force remount when venue or seat count changes
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
            isFavorited={isFavorited}
            onToggleFavorite={onToggleFavorite}
            dealBadge={venue.dealBadge}
            initialSeatCount={initialSeatCount}
          />
        </div>
      </div>
    </>
  )
}
