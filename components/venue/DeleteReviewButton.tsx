"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/toast"

interface DeleteReviewButtonProps {
  reviewId: string
}

export function DeleteReviewButton({ reviewId }: DeleteReviewButtonProps) {
  const router = useRouter()
  const { showToast, ToastComponent } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/reviews/${reviewId}`, { method: "DELETE" })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || "Failed to delete review")
      }

      showToast("Review removed", "success")
      router.refresh()
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to delete review", "error")
      setIsDeleting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 hover:text-destructive transition-colors disabled:opacity-50"
      >
        {isDeleting ? "Removing..." : "Delete"}
      </button>
      {ToastComponent}
    </>
  )
}
