"use client"

import { useRouter } from "next/navigation"
import { X } from "lucide-react"

interface VenuePageHeaderProps {
  name: string
  address?: string | null
  returnTo?: string
}

export function VenuePageHeader({ name, address, returnTo }: VenuePageHeaderProps) {
  const router = useRouter()

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
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl pr-8">
        {name}
      </h1>
      {address && (
        <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">
          {address}
        </p>
      )}
    </div>
  )
}
