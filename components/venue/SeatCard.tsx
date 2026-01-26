"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { ImageGalleryModal } from "@/components/ui/ImageGalleryModal"

interface SeatCardProps {
  seat: {
    id: string
    label: string | null
    position: number | null
    pricePerHour: number
    tags: string[]
    imageUrls: string[]
  }
  table: {
    id: string
    name: string | null
    imageUrls: string[]
  }
  isAvailable: boolean
  isSelected: boolean
  isCommunal?: boolean
  nextAvailableAt?: string | null
  onSelect: () => void
}

export function SeatCard({
  seat,
  table,
  isAvailable,
  isSelected,
  isCommunal,
  nextAvailableAt,
  onSelect,
}: SeatCardProps) {
  const [isImageOpen, setIsImageOpen] = useState(false)
  // Only show seat's own photos, no table fallback
  const thumbnailUrl = seat.imageUrls.length > 0 ? seat.imageUrls[0] : null

  // Display label or fallback to "Seat {position}"
  const displayLabel = seat.label || `Seat ${seat.position ?? "?"}`

  return (
    <>
      <button
        type="button"
        onClick={onSelect}
        disabled={!isAvailable}
        className={cn(
          "relative w-full rounded-md border p-3 text-left transition-all",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
          isSelected
            ? "border-primary ring-2 ring-primary"
            : isAvailable
              ? "border-muted hover:border-primary/50"
              : "cursor-not-allowed opacity-50"
        )}
      >
        {/* Thumbnail image */}
        {thumbnailUrl && (
          <div
            className="mb-2 aspect-square w-full overflow-hidden rounded-md cursor-zoom-in"
            onClick={(e) => {
              // Don't select the seat when user is just trying to view the photo
              e.preventDefault()
              e.stopPropagation()
              if (seat.imageUrls.length > 0) setIsImageOpen(true)
            }}
          >
            <img
              src={thumbnailUrl}
              alt={displayLabel}
              className="h-full w-full object-cover"
              draggable={false}
            />
          </div>
        )}

      {/* Label */}
      <div className="mb-1">
        <h3 className="text-sm font-medium">{displayLabel}</h3>
        {table.name && (
          <p className="text-xs text-muted-foreground">{table.name}</p>
        )}
      </div>

      {/* Price */}
      <div className="mb-2">
        <span className="text-lg font-semibold">
          ${seat.pricePerHour.toFixed(0)}
        </span>
        <span className="ml-1 text-sm text-muted-foreground">/hour</span>
      </div>

      {/* Communal indicator */}
      {isCommunal && (
        <div className="mb-2 space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <svg
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span>Communal space</span>
          </div>
          <p className="text-xs italic text-muted-foreground">
            Note: This is a communal space. Other guests may be seated at the same table.
          </p>
        </div>
      )}

      {/* Next available time for unavailable seats */}
      {!isAvailable && nextAvailableAt && (
        <div className="mb-2">
          <p className="text-xs text-muted-foreground">
            Next available: {new Date(nextAvailableAt).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
      )}

      {/* Tags */}
      {seat.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {seat.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {tag}
            </span>
          ))}
          {seat.tags.length > 3 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              +{seat.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute right-2 top-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <svg
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>
      )}
      </button>

      <ImageGalleryModal
        images={seat.imageUrls}
        initialIndex={0}
        isOpen={isImageOpen}
        onClose={() => setIsImageOpen(false)}
      />
    </>
  )
}
