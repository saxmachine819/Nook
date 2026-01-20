import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { MapPin } from "lucide-react"

interface VenueCardProps {
  id: string
  name: string
  address?: string
  neighborhood?: string
  city?: string
  state?: string
  hourlySeatPrice?: number
  tags?: string[]
  className?: string
  missingLocation?: boolean
}

export function VenueCard({
  id,
  name,
  address,
  neighborhood,
  city,
  state,
  hourlySeatPrice = 15,
  tags = [],
  className,
  missingLocation = false,
}: VenueCardProps) {
  // Format location display: prefer neighborhood, fallback to address, then city/state
  const locationDisplay = neighborhood || address || (city && state ? `${city}, ${state}` : city || "")

  return (
    <Link href={`/venue/${id}`}>
      <Card className={cn("transition-shadow hover:shadow-md", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold leading-tight">{name}</h3>
              {locationDisplay && (
                <div className="mt-1 flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {locationDisplay}
                  </p>
                  {missingLocation && (
                    <span className="ml-2 text-xs text-muted-foreground opacity-50">
                      (location missing)
                    </span>
                  )}
                </div>
              )}
            </div>
            <span className="ml-2 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              Check availability
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <div className="text-base font-medium text-foreground">
              ${hourlySeatPrice.toFixed(2)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                / seat / hour
              </span>
            </div>
            {tags.length > 0 && (
              <div className="flex gap-1">
                {tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}