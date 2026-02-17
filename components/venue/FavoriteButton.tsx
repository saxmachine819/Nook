"use client"

import React from "react"
import { Heart } from "lucide-react"
import { cn } from "@/lib/utils"
import { useFavoriteToggle } from "@/lib/hooks"

interface FavoriteButtonProps {
  type: "venue" | "table" | "seat"
  itemId: string
  venueId?: string
  initialFavorited?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
  onToggle?: (favorited: boolean) => void
  onClick?: (e: React.MouseEvent) => void
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
}

export function FavoriteButton({
  type,
  itemId,
  venueId,
  initialFavorited = false,
  size = "md",
  className,
  onToggle,
  onClick,
}: FavoriteButtonProps) {
  const { isFavorited, toggleFavorite, isToggling, SignInModalComponent } = useFavoriteToggle({
    type,
    itemId,
    venueId,
    initialFavorited,
    onToggle,
  })

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (onClick) {
      onClick(e)
    }
    toggleFavorite()
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isToggling}
        className={cn(
          "transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-full p-1",
          isFavorited
            ? "text-primary fill-primary"
            : "text-muted-foreground hover:text-primary",
          className
        )}
        aria-label={isFavorited ? `Remove ${type} from favorites` : `Add ${type} to favorites`}
      >
        <Heart
          className={cn(
            sizeClasses[size],
            isFavorited ? "fill-current" : "stroke-current fill-none"
          )}
        />
      </button>
      {SignInModalComponent}
    </>
  )
}
