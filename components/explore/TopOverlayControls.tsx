"use client"

import { SearchBar } from "@/components/explore/SearchBar"
import { FilterPanel, FilterState } from "@/components/explore/FilterPanel"
import { Button } from "@/components/ui/button"
import { Filter } from "lucide-react"
import { cn } from "@/lib/utils"

interface TopOverlayControlsProps {
  onSearch: (query: string) => void
  filterPanelOpen: boolean
  onFilterPanelOpenChange: (open: boolean) => void
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  onApplyFilters: () => void
  onClearFilters: () => void
  activeFilterCount: number
  className?: string
}

export function TopOverlayControls({
  onSearch,
  filterPanelOpen,
  onFilterPanelOpenChange,
  filters,
  onFiltersChange,
  onApplyFilters,
  onClearFilters,
  activeFilterCount,
  className,
}: TopOverlayControlsProps) {
  return (
    <>
      <div
        className={cn(
          "relative z-10 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3",
          className
        )}
      >
        <div className="flex gap-3">
          <div className="flex-1 min-w-0">
            <SearchBar onSearch={onSearch} />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onFilterPanelOpenChange(true)}
            className="relative shrink-0 h-10 w-10 rounded-lg border-input bg-background/80"
            aria-label="Filter workspaces"
          >
            <Filter className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>
      </div>
      <FilterPanel
        open={filterPanelOpen}
        onOpenChange={onFilterPanelOpenChange}
        filters={filters}
        onFiltersChange={onFiltersChange}
        onApply={onApplyFilters}
        onClear={onClearFilters}
      />
    </>
  )
}
