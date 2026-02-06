"use client"

import { useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useToast } from "@/components/ui/toast"
import { SignInModal } from "@/components/auth/SignInModal"

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

      showToast(favorited ? "Saved" : "Removed", "success")

      if (onToggle) {
        onToggle(favorited)
      }
    } catch (error) {
      console.error("Error toggling favorite:", error)
      showToast(error instanceof Error ? error.message : "Failed to toggle favorite", "error")
    } finally {
      setIsToggling(false)
    }
  }, [type, itemId, venueId, isFavorited, session, status, showToast, onToggle])

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

  return {
    isFavorited,
    toggleFavorite,
    isToggling,
    SignInModalComponent,
  }
}
