"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DealType, type Deal } from "@prisma/client"
import { formatEligibilitySummary } from "@/lib/deal-utils"
import { cn } from "@/lib/utils"
import { Edit, Trash2 } from "lucide-react"

interface DealListProps {
  deals: Deal[]
  venueId: string
  onRefresh: () => void
  onEdit: (deal: Deal) => void
}

export function DealList({ deals, venueId, onRefresh, onEdit }: DealListProps) {
  const [togglingActive, setTogglingActive] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleToggleActive = async (dealId: string, currentActive: boolean) => {
    setTogglingActive(dealId)
    try {
      const response = await fetch(`/api/venues/${venueId}/deals/${dealId}/active`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentActive }),
      })

      if (!response.ok) {
        throw new Error("Failed to toggle active status")
      }

      onRefresh()
    } catch (error) {
      alert("Failed to update deal status")
    } finally {
      setTogglingActive(null)
    }
  }

  const handleDelete = async (dealId: string) => {
    if (!confirm("Are you sure you want to delete this deal?")) {
      return
    }

    setDeleting(dealId)
    try {
      const response = await fetch(`/api/venues/${venueId}/deals/${dealId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete deal")
      }

      onRefresh()
    } catch (error) {
      alert("Failed to delete deal")
    } finally {
      setDeleting(null)
    }
  }

  const getTypeBadgeColor = (type: DealType) => {
    switch (type) {
      case DealType.FREE_ITEM:
        return "bg-green-100 text-green-800"
      case DealType.PERCENT_OFF:
        return "bg-blue-100 text-blue-800"
      case DealType.AMOUNT_OFF:
        return "bg-purple-100 text-purple-800"
      case DealType.TIME_WINDOW:
        return "bg-orange-100 text-orange-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getTypeLabel = (type: DealType) => {
    return type.replace(/_/g, " ")
  }

  // Separate active and inactive deals
  const activeDeals = deals.filter((d) => d.isActive)
  const inactiveDeals = deals.filter((d) => !d.isActive)

  if (deals.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm text-muted-foreground">
          No deals yet. Add your first deal to attract customers.
        </p>
      </div>
    )
  }

  const renderDealCard = (deal: Deal) => {
    const eligibilitySummary = formatEligibilitySummary(deal)
    const isTogglingActive = togglingActive === deal.id
    const isDeleting = deleting === deal.id

    return (
      <Card
        key={deal.id}
        className="transition-all"
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold">{deal.title}</h4>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    getTypeBadgeColor(deal.type)
                  )}
                >
                  {getTypeLabel(deal.type)}
                </span>
              </div>
              {eligibilitySummary && (
                <p className="text-xs text-muted-foreground">{eligibilitySummary}</p>
              )}
              <p className="text-sm text-muted-foreground">{deal.description}</p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {deal.isActive ? "Active" : "Inactive"}
                </span>
                <button
                  type="button"
                  onClick={() => handleToggleActive(deal.id, deal.isActive)}
                  disabled={isTogglingActive}
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors",
                    deal.isActive ? "bg-primary" : "bg-muted",
                    isTogglingActive && "opacity-50"
                  )}
                  title={deal.isActive ? "Click to deactivate (only one deal can be active at a time)" : "Click to activate (will deactivate other deals)"}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                      deal.isActive && "translate-x-5"
                    )}
                  />
                </button>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(deal)}
                  className="h-8 px-2 text-xs"
                >
                  <Edit className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(deal.id)}
                  disabled={isDeleting}
                  className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {activeDeals.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">Active Deals</h3>
          <div className="space-y-3">
            {activeDeals.map(renderDealCard)}
          </div>
        </div>
      )}
      {inactiveDeals.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">Inactive Deals</h3>
          <div className="space-y-3">
            {inactiveDeals.map(renderDealCard)}
          </div>
        </div>
      )}
    </div>
  )
}
