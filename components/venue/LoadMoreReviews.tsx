"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { ReviewListItem, type VenueReviewItem } from "./VenueReviewsSection"

interface LoadMoreReviewsProps {
  venueId: string
  cursor: string
  currentUserId?: string | null
}

export function LoadMoreReviews({ venueId, cursor: initialCursor, currentUserId }: LoadMoreReviewsProps) {
  const [reviews, setReviews] = useState<VenueReviewItem[]>([])
  const [cursor, setCursor] = useState(initialCursor)
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  const loadMore = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/venues/${venueId}/reviews?cursor=${cursor}&limit=10`)
      const data = await response.json()
      setReviews((prev) => [...prev, ...(data.reviews || [])])
      setHasMore(!!data.nextCursor)
      if (data.nextCursor) setCursor(data.nextCursor)
    } catch (error) {
      console.error("Error loading more reviews:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {reviews.map((review) => (
        <ReviewListItem key={review.id} review={review} currentUserId={currentUserId} />
      ))}
      {hasMore && (
        <div className="pt-2 text-center">
          <Button
            type="button"
            variant="outline"
            onClick={loadMore}
            disabled={isLoading}
            className="rounded-full font-bold"
          >
            {isLoading ? <LoadingSpinner size="sm" /> : "Load more reviews"}
          </Button>
        </div>
      )}
    </>
  )
}
