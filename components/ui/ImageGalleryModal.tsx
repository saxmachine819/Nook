"use client"

import { useState, useEffect, useRef } from "react"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface ImageGalleryModalProps {
  images: string[]
  initialIndex: number
  isOpen: boolean
  onClose: () => void
}

// Movement below this is still a tap, not a drag.
const TAP_SLOP_PX = 8
// Horizontal drag that commits to the next/previous image.
const PAGE_SWIPE_PX = 50
// Vertical drag that dismisses the gallery.
const DISMISS_DRAG_PX = 90

export function ImageGalleryModal({
  images,
  initialIndex,
  isOpen,
  onClose,
}: ImageGalleryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [isDragging, setIsDragging] = useState(false)
  const [translateX, setTranslateX] = useState(0)
  const [translateY, setTranslateY] = useState(0)

  // A drag locks to one axis on first movement: horizontal pages between
  // images, vertical dismisses. Kept in a ref (not state) because the click
  // handler runs in the same tick as the pointer-up that ends a drag, and
  // needs to know synchronously whether this was a tap or the tail of a drag.
  const axisRef = useRef<"x" | "y" | null>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)

  // Update current index when initialIndex changes
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex)
    }
  }, [initialIndex, isOpen])

  // Reset dragging state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsDragging(false)
      setTranslateX(0)
      setTranslateY(0)
      axisRef.current = null
      startRef.current = null
    }
  }, [isOpen])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      } else if (e.key === "ArrowLeft" && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1)
      } else if (e.key === "ArrowRight" && currentIndex < images.length - 1) {
        setCurrentIndex(currentIndex + 1)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, currentIndex, images.length, onClose])

  // Lock the page behind the gallery. Without this the venue page scrolls
  // under the overlay, which reads as the gallery itself being stuck.
  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  if (!isOpen || images.length === 0) return null

  const startDrag = (x: number, y: number) => {
    startRef.current = { x, y }
    axisRef.current = null
    setIsDragging(true)
    setTranslateX(0)
    setTranslateY(0)
  }

  const moveDrag = (x: number, y: number) => {
    const start = startRef.current
    if (!isDragging || !start) return

    const dx = x - start.x
    const dy = y - start.y

    if (!axisRef.current && Math.hypot(dx, dy) > TAP_SLOP_PX) {
      axisRef.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y"
    }

    if (axisRef.current === "x") {
      setTranslateX(dx)
    } else if (axisRef.current === "y") {
      setTranslateY(dy)
    }
  }

  const endDrag = () => {
    if (!isDragging) return
    setIsDragging(false)
    startRef.current = null

    const axis = axisRef.current

    if (axis === "y" && Math.abs(translateY) > DISMISS_DRAG_PX) {
      onClose()
      return
    }

    if (axis === "x" && Math.abs(translateX) > PAGE_SWIPE_PX) {
      if (translateX > 0 && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1)
      } else if (translateX < 0 && currentIndex < images.length - 1) {
        setCurrentIndex(currentIndex + 1)
      }
    }

    setTranslateX(0)
    setTranslateY(0)
  }

  const cancelDrag = () => {
    if (!isDragging) return
    setIsDragging(false)
    startRef.current = null
    axisRef.current = null
    setTranslateX(0)
    setTranslateY(0)
  }

  // Tap anywhere that isn't a control closes the gallery. The image fills the
  // viewport, so requiring a tap on "backdrop only" would leave no reachable
  // target at all.
  const handleTapToClose = () => {
    if (axisRef.current) {
      axisRef.current = null
      return
    }
    onClose()
  }

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const goToNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  // Fade out as the gallery is dragged away, so the drag reads as a dismissal.
  const dismissProgress = Math.min(Math.abs(translateY) / (DISMISS_DRAG_PX * 2), 1)

  return (
    <div
      // z-[55] sits above the bottom nav (z-50) but below the native
      // status-bar scrim (z-60), which stays opaque over the dark gallery so
      // the iOS status bar's dark text remains readable.
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Image gallery"
      onClick={handleTapToClose}
      style={{
        opacity: 1 - dismissProgress * 0.6,
        transition: isDragging ? "none" : "opacity 300ms ease-out",
      }}
    >
      {/* Close button. Offset below the status bar: in the native shell the
          WebView spans the full screen, so a flat top-4 puts this under the
          Dynamic Island and behind the opaque status-bar scrim. */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        className="absolute right-4 top-[max(1rem,var(--safe-area-top))] z-50 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
        aria-label="Close gallery"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Previous button */}
      {currentIndex > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            goToPrevious()
          }}
          className="absolute left-4 z-50 rounded-full bg-black/50 p-3 text-white hover:bg-black/70 transition-colors"
          aria-label="Previous image"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Next button */}
      {currentIndex < images.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            goToNext()
          }}
          className="absolute right-4 z-50 rounded-full bg-black/50 p-3 text-white hover:bg-black/70 transition-colors"
          aria-label="Next image"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Image container. Clicks bubble to the backdrop handler above — this
          is what makes tap-to-dismiss reachable. */}
      <div
        className="relative h-full w-full"
        style={{
          transform: `translateY(${translateY}px)`,
          transition: isDragging ? "none" : "transform 300ms ease-out",
        }}
        onTouchStart={(e) => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => moveDrag(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={endDrag}
        onTouchCancel={cancelDrag}
        onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
        onMouseMove={(e) => moveDrag(e.clientX, e.clientY)}
        onMouseUp={endDrag}
        onMouseLeave={cancelDrag}
      >
        <div
          className="flex h-full"
          style={{
            transform: `translateX(-${currentIndex * 100}%) translateX(${translateX}px)`,
            transition: isDragging ? "none" : "transform 300ms ease-out",
          }}
        >
          {images.map((image, index) => (
            <div
              key={index}
              className="h-full w-full shrink-0 flex items-center justify-center p-4"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- gallery modal dynamic URLs */}
              <img
                src={image}
                alt={`Image ${index + 1} of ${images.length}`}
                className="max-h-full max-w-full object-contain"
                draggable={false}
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = "none"
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Image counter. Offset above the home indicator so the native shell
          doesn't bury it. */}
      {images.length > 1 && (
        <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-50 rounded-full bg-black/50 px-4 py-2 text-sm text-white">
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* Pagination dots */}
      {images.length > 1 && (
        <div className="absolute bottom-[max(4rem,calc(env(safe-area-inset-bottom)+3rem))] left-1/2 flex -translate-x-1/2 gap-2 z-50">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation()
                setCurrentIndex(index)
              }}
              className={cn(
                "h-2 rounded-full transition-all",
                index === currentIndex
                  ? "w-8 bg-white"
                  : "w-2 bg-white/50 hover:bg-white/75"
              )}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
