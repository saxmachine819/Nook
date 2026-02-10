"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { ImageGalleryModal } from "@/components/ui/ImageGalleryModal"

interface VenueImageCarouselProps {
  images: string[]
  className?: string
  enableGallery?: boolean // If false, clicking images won't open full-screen gallery
}

export function VenueImageCarousel({ images, className, enableGallery = true }: VenueImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [translateX, setTranslateX] = useState(0)
  const [isGalleryOpen, setIsGalleryOpen] = useState(false)
  const carouselRef = useRef<HTMLDivElement>(null)

  // If no images, show placeholder
  if (!images || images.length === 0) {
    return (
      <div
        className={cn(
          "flex h-[217px] w-full items-center justify-center bg-muted sm:h-64",
          className
        )}
      >
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="mt-2 text-sm text-muted-foreground">No image available</p>
        </div>
      </div>
    )
  }

  // If single image, no carousel needed
  if (images.length === 1) {
    return (
      <div className={cn("relative h-[217px] w-full overflow-hidden sm:h-64", className)}>
        <img
          src={images[0]}
          alt="Venue"
          className="h-full w-full object-cover"
          onError={(e) => {
            // Fallback if image fails to load
            const target = e.target as HTMLImageElement
            target.style.display = "none"
          }}
        />
      </div>
    )
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true)
    setStartX(e.touches[0].clientX)
    setTranslateX(0)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    const currentX = e.touches[0].clientX
    const diff = currentX - startX
    setTranslateX(diff)
  }

  const handleTouchEnd = () => {
    if (!isDragging) return
    setIsDragging(false)

    const threshold = 50 // Minimum swipe distance
    if (Math.abs(translateX) > threshold) {
      if (translateX > 0 && currentIndex > 0) {
        // Swipe right - go to previous
        setCurrentIndex(currentIndex - 1)
      } else if (translateX < 0 && currentIndex < images.length - 1) {
        // Swipe left - go to next
        setCurrentIndex(currentIndex + 1)
      }
    }
    setTranslateX(0)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setStartX(e.clientX)
    setTranslateX(0)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    const currentX = e.clientX
    const diff = currentX - startX
    setTranslateX(diff)
  }

  const handleMouseUp = () => {
    if (!isDragging) return
    setIsDragging(false)

    const threshold = 50
    if (Math.abs(translateX) > threshold) {
      if (translateX > 0 && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1)
      } else if (translateX < 0 && currentIndex < images.length - 1) {
        setCurrentIndex(currentIndex + 1)
      }
    }
    setTranslateX(0)
  }

  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false)
      setTranslateX(0)
    }
  }

  // Reset to first image if images array changes
  useEffect(() => {
    setCurrentIndex(0)
  }, [images.length])

  return (
    <>
      <div className={cn("relative h-64 w-full overflow-hidden sm:h-72", className)}>
        <div
          ref={carouselRef}
          className="flex h-full transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] touch-pan-x"
          style={{
            transform: `translateX(-${currentIndex * 100}%) translateX(${translateX}px)`,
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          {images.map((image, index) => (
            <div
              key={index}
              className={cn("h-full w-full shrink-0", enableGallery && "cursor-pointer")}
              onClick={enableGallery ? () => setIsGalleryOpen(true) : undefined}
            >
              <img
                src={image}
                alt={`Venue image ${index + 1}`}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = "none"
                }}
              />
            </div>
          ))}
        </div>

        {/* Gradient Overlay for bottom contrast */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

        {/* Pagination dots */}
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
          {images.map((_, index) => (
            <div
              key={index}
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                setCurrentIndex(index)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setCurrentIndex(index)
                }
              }}
              className={cn(
                "h-1 rounded-full transition-all duration-300",
                index === currentIndex
                  ? "w-8 bg-white shadow-sm"
                  : "w-1.5 bg-white/40 hover:bg-white/60"
              )}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      </div>


      {/* Full-screen gallery modal - only render if gallery is enabled */}
      {enableGallery && (
        <ImageGalleryModal
          images={images}
          initialIndex={currentIndex}
          isOpen={isGalleryOpen}
          onClose={() => setIsGalleryOpen(false)}
        />
      )}
    </>
  )
}
