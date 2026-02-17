"use client"

import { useRouter } from "next/navigation"
import { X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { formatEligibilitySummary, generateDescription } from "@/lib/deal-utils"
import { FavoriteButton } from "./FavoriteButton"

interface VenuePageHeaderProps {
  name: string
  address?: string | null
  returnTo?: string
  isFavorited?: boolean
  venueId?: string
  deal?: {
    title: string
    description?: string | null
    type: string
    eligibilityJson?: any
  } | null
}

export function VenuePageHeader({ name, address, returnTo, isFavorited = false, venueId, deal }: VenuePageHeaderProps) {
  const router = useRouter()

  const eligibility = deal?.eligibilityJson || {}
  const eligibilitySummary = deal ? formatEligibilitySummary(deal as any) : null
  const dealDescription = deal ? generateDescription(deal.type as any, eligibility) : null

  return (
    <div className="relative">
      <div className="absolute -top-4 -right-2 z-10 flex items-center gap-3">
        {venueId && (
          <FavoriteButton
            type="venue"
            itemId={venueId}
            initialFavorited={isFavorited}
            size="md"
            className="rounded-full glass p-2.5 shadow-lg transition-transform hover:scale-110 active:scale-90"
          />
        )}
        <button
          type="button"
          onClick={() => router.push(returnTo || "/")}
          className="rounded-full glass p-2.5 text-muted-foreground hover:bg-black/5 hover:text-foreground transition-all duration-300 active:scale-90 shadow-lg"
          aria-label={returnTo ? "Close and return to reservation" : "Close and return to explore"}
        >
          <X size={20} strokeWidth={2.5} />
        </button>
      </div>
      <div className="flex flex-col gap-6 pr-12 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-4xl font-black tracking-tight text-foreground/90 sm:text-5xl lg:text-6xl">
            {name}
          </h1>
          {address && (
            <p className="text-base font-medium text-muted-foreground/80 sm:text-lg">
              {address}
            </p>
          )}
        </div>
        {deal && (
          <div className="w-full flex-shrink-0 sm:max-w-xs lg:hidden">
            <Card className="overflow-hidden border-none bg-emerald-500 shadow-lg shadow-emerald-500/20 h-fit rounded-[2rem]">
              <CardContent className="p-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="flex-shrink-0 rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">
                      Special Deal
                    </span>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold tracking-tight text-white leading-tight">
                      {deal.title}
                    </h3>
                    {eligibilitySummary && (
                      <p className="text-xs font-bold text-white/80">
                        {eligibilitySummary}
                      </p>
                    )}
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4">
                    <p className="text-xs font-medium leading-relaxed text-white/90">
                      {deal.description || dealDescription}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
