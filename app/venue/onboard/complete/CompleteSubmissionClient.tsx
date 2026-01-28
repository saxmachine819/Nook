"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { CheckCircle2 } from "lucide-react"

interface CompleteSubmissionClientProps {
  venueId: string
  venueName: string
}

export function CompleteSubmissionClient({ venueId, venueName }: CompleteSubmissionClientProps) {
  const router = useRouter()
  const { showToast, ToastComponent } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async () => {
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/venues/${venueId}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMessage = data.error || "Failed to submit venue request. Please try again."
        showToast(errorMessage, "error")
        setIsSubmitting(false)
        return
      }

      setIsSubmitted(true)
      showToast("Venue request submitted successfully!", "success")
    } catch (error) {
      console.error("Error submitting venue:", error)
      showToast("An error occurred. Please try again.", "error")
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="container mx-auto px-4 py-6">
        {ToastComponent}
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl">Thanks—your venue request is submitted.</CardTitle>
              <CardDescription className="text-base">
                We'll review and follow up shortly.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Your venue "{venueName}" has been submitted for review.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <Button asChild variant="outline">
                    <Link href="/profile">Go to Profile</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/venue/dashboard">View Dashboard</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {ToastComponent}
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">Complete venue request</h1>

      <Card>
        <CardHeader>
          <CardTitle>Review and Submit</CardTitle>
          <CardDescription>
            Review your venue details and submit for approval
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium">Venue: {venueName}</p>
            <p className="text-sm text-muted-foreground">
              Once submitted, your venue request will be reviewed by our team.
            </p>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            size="lg"
            className="w-full sm:w-auto"
          >
            {isSubmitting ? "Submitting..." : "Complete venue request"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
