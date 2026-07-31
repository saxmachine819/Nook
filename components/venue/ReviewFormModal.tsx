"use client"

import { useState } from "react"
import { Star } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useReviewSubmit } from "@/lib/hooks"

interface ReviewFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reservationId: string
  venueName: string
  onSubmitted?: () => void
}

export function ReviewFormModal({ open, onOpenChange, reservationId, venueName, onSubmitted }: ReviewFormModalProps) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState("")
  const { submitReview, isSubmitting } = useReviewSubmit({ reservationId })

  const handleSubmit = async () => {
    if (rating < 1) return
    const success = await submitReview(rating, comment)
    if (success) {
      setRating(0)
      setComment("")
      onOpenChange(false)
      onSubmitted?.()
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setRating(0)
      setComment("")
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Review {venueName}</DialogTitle>
          <DialogDescription>How was your visit?</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                aria-label={`${star} star${star === 1 ? "" : "s"}`}
                className="p-1"
              >
                <Star
                  className={cn(
                    "h-8 w-8 transition-colors",
                    star <= (hoverRating || rating)
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/20"
                  )}
                />
              </button>
            ))}
          </div>
          <Textarea
            placeholder="Share more about your visit (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={rating < 1 || isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
