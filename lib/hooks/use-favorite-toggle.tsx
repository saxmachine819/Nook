"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/components/ui/toast"
import { SignInModal } from "@/components/auth/SignInModal"
import { useVenueFavorites } from "./use-venue-favorites"

type FavoriteType = "venue" | "table" | "seat"

interface UseFavoriteToggleOptions {
  type: FavoriteType
  itemId: string
  venueId?: string
  initialFavorited?: boolean
  onToggle?: (favorited: boolean) => void
}

export function useFavoriteToggle({
  type,
  itemId,
  venueId,
  initialFavorited = false,
  onToggle,
}: UseFavoriteToggleOptions) {
  const { data: session, status } = useSession()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [isFavorited, setIsFavorited] = useState(initialFavorited)
  const [isToggling, setIsToggling] = useState(false)
  const [showSignInModal, setShowSignInModal] = useState(false)

  const toggleFavorite = useCallback(async () => {
    if (status === "loading") {
      return
    }

    if (!session?.user?.id) {
      setShowSignInModal(true)
      return
    }

    const previousState = isFavorited
    setIsFavorited(!previousState)
    setIsToggling(true)
    // Re-enable the button after a short cooldown so the user can click again; request may still be in flight
    let cooldownId: ReturnType<typeof setTimeout> | null = setTimeout(() => setIsToggling(false), 400)

    try {
      let url: string
      let body: Record<string, string> = {}

      if (type === "venue") {
        url = `/api/favorites/venues/${itemId}`
      } else if (type === "table") {
        url = `/api/favorites/tables/${itemId}`
        if (!venueId) {
          throw new Error("venueId is required for table favorites")
        }
        body = { venueId }
      } else if (type === "seat") {
        url = `/api/favorites/seats/${itemId}`
        if (!venueId) {
          throw new Error("venueId is required for seat favorites")
        }
        body = { venueId }
      } else {
        throw new Error(`Invalid favorite type: ${type}`)
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setIsFavorited(previousState)

        if (response.status === 401) {
          setShowSignInModal(true)
          return
        }

        throw new Error(data?.error || "Failed to toggle favorite")
      }

      const favorited = data.favorited ?? !previousState
      setIsFavorited(favorited)

      // Update the venue-favorites cache immediately so sync effect / readers see the new value (avoids stale overwrite on unheart)
      if (type === "venue") {
        queryClient.setQueryData(
          ["venueFavorites", itemId],
          (prev: { venue: boolean; tables: string[]; seats: string[] } | undefined) =>
            prev ? { ...prev, venue: favorited } : { venue: favorited, tables: [], seats: [] }
        )
        await queryClient.invalidateQueries({ queryKey: ["venueFavorites", itemId] })
      } else if (venueId) {
        await queryClient.invalidateQueries({ queryKey: ["venueFavorites", venueId] })
      }

      showToast(favorited ? "Saved" : "Removed", "success")

      if (onToggle) {
        onToggle(favorited)
      }
    } catch (error) {
      console.error("Error toggling favorite:", error)
      showToast(error instanceof Error ? error.message : "Failed to toggle favorite", "error")
    } finally {
      if (cooldownId != null) clearTimeout(cooldownId)
      setIsToggling(false)
    }
  }, [type, itemId, venueId, isFavorited, session, status, showToast, onToggle, queryClient])

  const handleSignInSuccess = useCallback(() => {
    setShowSignInModal(false)
    toggleFavorite()
  }, [toggleFavorite])

  const SignInModalComponent = showSignInModal ? (
    <SignInModal
      open={showSignInModal}
      onOpenChange={setShowSignInModal}
      onSignInSuccess={handleSignInSuccess}
    />
  ) : null

  const { data: clientFavs } = useVenueFavorites(venueId ?? itemId, type === "venue")
  const clientFavorited = clientFavs?.venue
  const hasSyncedFromServerRef = useRef(false)
  const lastSyncedKeyRef = useRef<string | null>(null)
  const venueKey = type === "venue" ? itemId : venueId ?? itemId

  // Reset sync ref when switching to a different venue/item so we sync again for the new item
  if (lastSyncedKeyRef.current !== venueKey) {
    lastSyncedKeyRef.current = venueKey
    hasSyncedFromServerRef.current = false
  }

  // Sync from server only when query first loads for this item (so we show server state on mount). Don't sync on every refetch or we'd overwrite optimistic updates.
  useEffect(() => {
    if (type !== "venue" || clientFavorited === undefined) return
    if (!hasSyncedFromServerRef.current) {
      hasSyncedFromServerRef.current = true
      setIsFavorited(clientFavorited)
    }
  }, [type, clientFavorited])

  // Use local state for display so optimistic update is instant; server state syncs via effect above
  return {
    isFavorited,
    toggleFavorite,
    isToggling,
    SignInModalComponent,
  }
}
