"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface FilterState {
  tags: string[]
  priceMin: number | null
  priceMax: number | null
  availableNow: boolean
  seatCount: number | null
  bookingMode: ("communal" | "full-table")[]
  dealsOnly: boolean
}

interface FilterPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  onApply: (appliedFilters?: FilterState) => void
  onClear: () => void
}

const AVAILABLE_TAGS = [
  "Quiet",
  "Strong Wi-Fi",
  "Outlets",
  "Call-Friendly",
  "Cozy",
  "Bright",
]

export function FilterPanel({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  onApply,
  onClear,
}: FilterPanelProps) {
  const [localFilters, setLocalFilters] = useState<FilterState>(filters)

  // Sync local state with props when dialog opens
  useEffect(() => {
    if (open) {
      setLocalFilters(filters)
    }
  }, [open, filters])

  const handleTagToggle = (tag: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }))
  }

  const handlePriceMinChange = (value: string) => {
    const num = value === "" ? null : parseFloat(value)
    setLocalFilters((prev) => ({
      ...prev,
      priceMin: num !== null && !isNaN(num) ? num : null,
    }))
  }

  const handlePriceMaxChange = (value: string) => {
    const num = value === "" ? null : parseFloat(value)
    setLocalFilters((prev) => ({
      ...prev,
      priceMax: num !== null && !isNaN(num) ? num : null,
    }))
  }

  const handleAvailableNowToggle = () => {
    setLocalFilters((prev) => ({
      ...prev,
      availableNow: !prev.availableNow,
    }))
  }

  const handleApply = () => {
    onFiltersChange(localFilters)
    // Pass localFilters directly to avoid timing issues with ref updates
    onApply(localFilters)
    onOpenChange(false)
  }

  const handleClear = () => {
    const clearedFilters: FilterState = {
      tags: [],
      priceMin: null,
      priceMax: null,
      availableNow: false,
      seatCount: null,
      bookingMode: [],
      dealsOnly: false,
    }
    setLocalFilters(clearedFilters)
    onFiltersChange(clearedFilters)
    onClear()
    onOpenChange(false)
  }

  const activeFilterCount =
    localFilters.tags.length +
    (localFilters.priceMin !== null ? 1 : 0) +
    (localFilters.priceMax !== null ? 1 : 0) +
    (localFilters.availableNow ? 1 : 0) +
    (localFilters.seatCount !== null ? 1 : 0) +
    localFilters.bookingMode.length +
    (localFilters.dealsOnly ? 1 : 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Filter workspaces</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Deals Only */}
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={localFilters.dealsOnly}
                onChange={() => {
                  setLocalFilters((prev) => ({
                    ...prev,
                    dealsOnly: !prev.dealsOnly,
                  }))
                }}
                className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
              />
              <span className="text-sm font-medium">Deals</span>
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              Show only venues with active deals
            </p>
          </div>

          {/* Tags */}
          <div>
            <h3 className="mb-3 text-sm font-medium">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagToggle(tag)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition-colors",
                    localFilters.tags.includes(tag)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input bg-background text-foreground hover:bg-accent"
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div>
            <h3 className="mb-3 text-sm font-medium">Price per seat per hour</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="priceMin" className="mb-1 block text-xs text-muted-foreground">
                  Min ($)
                </label>
                <input
                  id="priceMin"
                  type="number"
                  min="0"
                  step="0.01"
                  value={localFilters.priceMin ?? ""}
                  onChange={(e) => handlePriceMinChange(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label htmlFor="priceMax" className="mb-1 block text-xs text-muted-foreground">
                  Max ($)
                </label>
                <input
                  id="priceMax"
                  type="number"
                  min="0"
                  step="0.01"
                  value={localFilters.priceMax ?? ""}
                  onChange={(e) => handlePriceMaxChange(e.target.value)}
                  placeholder="No limit"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
          </div>

          {/* Availability */}
          <div>
            <h3 className="mb-3 text-sm font-medium">Availability</h3>
            
            {/* Available Now */}
            <div className="mb-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={localFilters.availableNow}
                  onChange={handleAvailableNowToggle}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
                />
                <span className="text-sm">Available now</span>
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                Show only venues that are open and have available seats right now.
              </p>
            </div>

            {/* Seat Count */}
            <div className="mb-4">
              <label htmlFor="seatCount" className="mb-1 block text-xs text-muted-foreground">
                Minimum seats available
              </label>
              <input
                id="seatCount"
                type="number"
                min="1"
                step="1"
                value={localFilters.seatCount ?? ""}
                onChange={(e) => {
                  const num = e.target.value === "" ? null : parseInt(e.target.value, 10)
                  setLocalFilters((prev) => ({
                    ...prev,
                    seatCount: num !== null && !isNaN(num) && num > 0 ? num : null,
                  }))
                }}
                placeholder="Any"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {/* Booking Mode */}
            <div>
              <label className="mb-2 block text-xs text-muted-foreground">
                Space type
              </label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={localFilters.bookingMode.includes("communal")}
                    onChange={() => {
                      setLocalFilters((prev) => ({
                        ...prev,
                        bookingMode: prev.bookingMode.includes("communal")
                          ? prev.bookingMode.filter((m) => m !== "communal")
                          : [...prev.bookingMode, "communal"],
                      }))
                    }}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
                  />
                  <span className="text-sm">Communal space</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={localFilters.bookingMode.includes("full-table")}
                    onChange={() => {
                      setLocalFilters((prev) => ({
                        ...prev,
                        bookingMode: prev.bookingMode.includes("full-table")
                          ? prev.bookingMode.filter((m) => m !== "full-table")
                          : [...prev.bookingMode, "full-table"],
                      }))
                    }}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
                  />
                  <span className="text-sm">Full table</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={handleClear}
            className="w-full sm:w-auto"
            disabled={activeFilterCount === 0}
          >
            Clear all
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            className="w-full sm:w-auto"
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
