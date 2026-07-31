import dayjs from "dayjs"
import { Star } from "lucide-react"
import { LoadMoreReviews } from "./LoadMoreReviews"
import { DeleteReviewButton } from "./DeleteReviewButton"

export interface VenueReviewItem {
  id: string
  userId: string
  rating: number
  comment: string | null
  createdAt: Date | string
  user: { name: string | null } | null
}

interface VenueReviewsSectionProps {
  venueId: string
  reviews: VenueReviewItem[]
  hasMore: boolean
  avgRating: number | null
  reviewCount: number
  currentUserId?: string | null
}

function ReviewStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={i <= rating ? "h-3.5 w-3.5 fill-amber-400 text-amber-400" : "h-3.5 w-3.5 text-muted-foreground/20"}
        />
      ))}
    </div>
  )
}

export function ReviewListItem({ review, currentUserId }: { review: VenueReviewItem; currentUserId?: string | null }) {
  const reviewerName = review.user?.name?.split(" ")[0] || "Guest"
  const isOwnReview = !!currentUserId && review.userId === currentUserId
  return (
    <div className="space-y-2 rounded-2xl border-none bg-primary/[0.03] p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {reviewerName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-bold text-foreground/80">{reviewerName}</p>
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
              {dayjs(review.createdAt).format("MMM D, YYYY")}
            </p>
          </div>
        </div>
        <ReviewStars rating={review.rating} />
      </div>
      {review.comment && (
        <p className="text-sm font-medium leading-relaxed text-foreground/70">{review.comment}</p>
      )}
      {isOwnReview && (
        <div className="flex justify-end">
          <DeleteReviewButton reviewId={review.id} />
        </div>
      )}
    </div>
  )
}

export function VenueReviewsSection({ venueId, reviews, hasMore, avgRating, reviewCount, currentUserId }: VenueReviewsSectionProps) {
  return (
    <div id="reviews" className="space-y-6 pt-0">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight">Reviews</h2>
        {reviewCount > 0 && avgRating != null && (
          <div className="flex items-center gap-1.5 text-sm font-bold text-foreground/80">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            {avgRating.toFixed(1)}
            <span className="font-medium text-muted-foreground/60">· {reviewCount} review{reviewCount === 1 ? "" : "s"}</span>
          </div>
        )}
      </div>

      {reviews.length === 0 ? (
        <p className="text-sm font-medium text-muted-foreground/70">
          No reviews yet
        </p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <ReviewListItem key={review.id} review={review} currentUserId={currentUserId} />
          ))}
          {hasMore && (
            <LoadMoreReviews
              venueId={venueId}
              cursor={reviews[reviews.length - 1].id}
              currentUserId={currentUserId}
            />
          )}
        </div>
      )}
    </div>
  )
}
