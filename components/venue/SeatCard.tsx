"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { ImageGalleryModal } from "@/components/ui/ImageGalleryModal"
import { FavoriteButton } from "./FavoriteButton"

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
  isFavorited?: boolean
  venueId?: string
  onSelect: () => void
}

export function SeatCard({
  seat,
  table,
  isAvailable,
  isSelected,
  isCommunal,
  nextAvailableAt,
  isFavorited = false,
  venueId,
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
          "relative w-full rounded-[2rem] border-none p-4 text-left transition-all duration-300",
          "focus:outline-none focus:ring-2 focus:ring-primary/20",
          isSelected
            ? "bg-white shadow-2xl ring-2 ring-primary scale-[1.02] z-10"
            : isAvailable
              ? "bg-primary/[0.02] hover:bg-white hover:shadow-xl hover:scale-[1.01]"
              : "cursor-not-allowed opacity-40 grayscale bg-muted"
        )}
      >
        {/* Thumbnail image */}
        {thumbnailUrl && (
          <div
            className="mb-4 aspect-square w-full overflow-hidden rounded-2xl cursor-zoom-in group"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (seat.imageUrls.length > 0) setIsImageOpen(true)
            }}
          >
            <img
              src={thumbnailUrl}
              alt={displayLabel}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              draggable={false}
            />
          </div>
        )}

        {/* Label */}
        <div className="mb-2">
          <h3 className="text-sm font-black tracking-tight text-foreground/80">{displayLabel}</h3>
          {table.name && (
            <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">{table.name}</p>
          )}
        </div>

        {/* Price */}
        <div className="mb-3">
          <span className="text-xl font-black tracking-tighter text-primary">
            ${seat.pricePerHour.toFixed(0)}
          </span>
          <span className="ml-1 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-tighter">/hr</span>
        </div>

        {/* Communal indicator */}
        {isCommunal && (
          <div className="mb-3 p-2 bg-primary/5 rounded-xl border border-primary/5">
            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-primary/60">
              <svg
                className="h-2.5 w-2.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <span>Communal</span>
            </div>
          </div>
        )}

        {/* Next available time for unavailable seats */}
        {!isAvailable && nextAvailableAt && (
          <div className="mb-3 px-2 py-1 bg-black/5 rounded-lg">
            <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-tight">
              Next: {new Date(nextAvailableAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
        )}

        {/* Tags */}
        {seat.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {seat.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-primary/5 border border-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary/40 uppercase tracking-tighter"
              >
                {tag}
              </span>
            ))}
            {seat.tags.length > 2 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold text-muted-foreground/40 uppercase tracking-tighter">
                +{seat.tags.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Favorite and selected indicators */}
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          {venueId && (
            <div onClick={(e) => e.stopPropagation()}>
              <FavoriteButton
                type="seat"
                itemId={seat.id}
                venueId={venueId}
                initialFavorited={isFavorited}
                size="sm"
                className="rounded-full glass p-1.5 shadow-lg transition-transform hover:scale-110"
              />
            </div>
          )}
          {isSelected && (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white shadow-lg animate-in zoom-in duration-300">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          )}
        </div>
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
