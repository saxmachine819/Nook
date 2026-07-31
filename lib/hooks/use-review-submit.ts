"use client"

import { useState, useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/components/ui/toast"

interface UseReviewSubmitOptions {
  reservationId: string
  onSuccess?: () => void
}

export function useReviewSubmit({ reservationId, onSuccess }: UseReviewSubmitOptions) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submitReview = useCallback(
    async (rating: number, comment: string) => {
      setIsSubmitting(true)
      try {
        const response = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reservationId, rating, comment: comment.trim() || undefined }),
        })
        const data = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(data?.error || "Failed to submit review")
        }

        showToast("Thanks for your review!", "success")
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["reservations", "past"] }),
          queryClient.invalidateQueries({ queryKey: ["reservationDetail", reservationId] }),
        ])
        onSuccess?.()
        return true
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Failed to submit review", "error")
        return false
      } finally {
        setIsSubmitting(false)
      }
    },
    [reservationId, showToast, queryClient, onSuccess]
  )

  const removeReview = useCallback(
    async (reviewId: string) => {
      try {
        const response = await fetch(`/api/reviews/${reviewId}`, { method: "DELETE" })
        const data = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(data?.error || "Failed to remove review")
        }

        showToast("Review removed", "success")
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["reservations", "past"] }),
          queryClient.invalidateQueries({ queryKey: ["reservationDetail", reservationId] }),
        ])
        return true
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Failed to remove review", "error")
        return false
      }
    },
    [reservationId, showToast, queryClient]
  )

  return { submitReview, removeReview, isSubmitting }
}
