"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LoadingOverlay } from "@/components/ui/loading-overlay"
import { MapPin } from "lucide-react"
import { cn } from "@/lib/utils"

interface VenuePreviewCardProps {
  id: string
  name: string
  address?: string
  city?: string
  state?: string
  minPrice?: number
  maxPrice?: number
  tags?: string[]
  availabilityLabel?: string
  className?: string
}

export function VenuePreviewCard({
  id,
  name,
  address,
  city,
  state,
  minPrice = 0,
  maxPrice = 0,
  tags = [],
  availabilityLabel,
  className,
}: VenuePreviewCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const locationDisplay = address || (city && state ? `${city}, ${state}` : city || "")
  const addressSnippet = locationDisplay
    ? locationDisplay.length > 60
      ? `${locationDisplay.slice(0, 57)}...`
      : locationDisplay
    : ""

  const priceText =
    minPrice === maxPrice
      ? `$${minPrice.toFixed(0)} / seat / hour`
      : `$${minPrice.toFixed(0)}–$${maxPrice.toFixed(0)} / seat / hour`

  const handleViewDetails = () => {
    startTransition(() => {
      router.push(`/venue/${id}`)
    })
  }

  return (
    <div className={cn("space-y-3", className)}>
      {isPending && (
        <LoadingOverlay label="Loading venue..." zIndex={100} />
      )}
      <h3 className="text-base font-semibold leading-tight">{name}</h3>
      {addressSnippet && (
        <div className="flex items-start gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{addressSnippet}</p>
        </div>
      )}
      <p className="text-sm text-muted-foreground">{priceText}</p>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-input bg-muted/50 px-2.5 py-0.5 text-xs text-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      {availabilityLabel && (
        <p className="text-xs font-medium text-primary">{availabilityLabel}</p>
      )}
      <Button onClick={handleViewDetails} className="w-full" size="sm">
        View details
      </Button>
    </div>
  )
}
