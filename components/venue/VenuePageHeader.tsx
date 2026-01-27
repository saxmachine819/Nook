"use client"

import { useRouter } from "next/navigation"
import { X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { formatEligibilitySummary, generateDescription } from "@/lib/deal-utils"

interface VenuePageHeaderProps {
  name: string
  address?: string | null
  returnTo?: string
  deal?: {
    title: string
    description?: string | null
    type: string
    eligibilityJson?: any
  } | null
}

export function VenuePageHeader({ name, address, returnTo, deal }: VenuePageHeaderProps) {
  const router = useRouter()

  const eligibility = deal?.eligibilityJson || {}
  const eligibilitySummary = deal ? formatEligibilitySummary(deal) : null
  const dealDescription = deal ? generateDescription(deal.type, eligibility) : null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => router.push(returnTo || "/")}
        className="absolute -top-2 -right-2 z-10 rounded-full p-1 text-muted-foreground hover:bg-muted transition-colors"
        aria-label={returnTo ? "Close and return to reservation" : "Close and return to explore"}
      >
        <X className="h-5 w-5" />
      </button>
      <div className="flex items-start justify-between gap-4 pr-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {name}
          </h1>
          {address && (
            <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">
              {address}
            </p>
          )}
        </div>
        {deal && (
          <div className="flex-shrink-0 w-full max-w-xs">
            <Card className="overflow-hidden border border-primary/15 bg-gradient-to-br from-primary/5 to-primary/2 shadow-sm h-fit">
              <CardContent className="p-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex-shrink-0 rounded-full bg-primary/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground whitespace-nowrap">
                      Deal
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold tracking-tight text-foreground leading-tight line-clamp-1">
                        {deal.title}
                      </h3>
                      {eligibilitySummary && (
                        <p className="text-[10px] font-medium text-primary/90 mt-0.5 line-clamp-1">
                          {eligibilitySummary}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border border-primary/10 bg-background/60 p-2">
                    <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
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
