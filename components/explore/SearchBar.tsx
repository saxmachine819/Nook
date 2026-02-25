"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Search, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface SearchBarProps {
  onSearch: (query: string) => void
  placeholder?: string
  className?: string
  /** When set, the search icon becomes a link to this href (e.g. /search). */
  searchIconHref?: string
}

export function SearchBar({ onSearch, placeholder = "Search cafés, hotel lobbies, neighborhoods...", className, searchIconHref }: SearchBarProps) {
  const [query, setQuery] = useState("")
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Debounce search calls (400ms delay)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      onSearch(query)
    }, 400)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [query, onSearch])

  const handleClear = () => {
    setQuery("")
    onSearch("")
  }

  return (
    <div className={cn("relative w-full group", className)}>
      <div className="relative flex items-center">
        {/* Search icon - link to /search when searchIconHref is set */}
        <div className="absolute left-4 z-10 text-primary/60 transition-colors group-focus-within:text-primary">
          {searchIconHref ? (
            <Link
              href={searchIconHref}
              className="flex items-center justify-center rounded-md p-1 -m-1 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              aria-label="Go to search"
            >
              <Search size={18} strokeWidth={2.5} />
            </Link>
          ) : (
            <Search size={18} strokeWidth={2.5} />
          )}
        </div>

        {/* Input */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-2xl border-none bg-white py-3.5 pl-12 pr-12 text-base font-medium premium-shadow ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 transition-all duration-300"
        />

        {/* Clear button */}
        {query.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-4 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary/5 text-primary/60 hover:bg-primary/10 hover:text-primary transition-all duration-300 active:scale-90"
            aria-label="Clear search"
          >
            <X size={14} strokeWidth={3} />
          </button>
        )}
      </div>
    </div>
  )
}

