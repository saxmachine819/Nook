import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface VenueRatingBadgeProps {
  avgRating: number | null
  reviewCount: number
  className?: string
}

export function VenueRatingBadge({ avgRating, reviewCount, className }: VenueRatingBadgeProps) {
  if (!avgRating || reviewCount <= 0) return null

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-bold text-foreground/80",
        className
      )}
    >
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      {avgRating.toFixed(1)}
      <span className="font-medium text-muted-foreground/70">({reviewCount})</span>
    </span>
  )
}
