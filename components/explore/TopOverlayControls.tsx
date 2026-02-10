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
  onApplyFilters: (appliedFilters?: FilterState) => void
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
          "relative z-10 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4",
          className
        )}
      >
        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
            <SearchBar onSearch={onSearch} />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onFilterPanelOpenChange(true)}
            className="relative shrink-0 h-14 w-14 rounded-2xl border-none bg-white font-bold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] premium-shadow"
            aria-label="Filter workspaces"
          >
            <Filter size={20} strokeWidth={2.5} className="text-primary/70" />
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground shadow-lg shadow-primary/20 animate-in zoom-in duration-300">
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
