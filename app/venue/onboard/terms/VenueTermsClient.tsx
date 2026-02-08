"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface VenueTermsClientProps {
  venueId: string
  venueName: string
}

export function VenueTermsClient({ venueId, venueName }: VenueTermsClientProps) {
  const router = useRouter()
  const { showToast, ToastComponent } = useToast()
  const [agreed, setAgreed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleContinue = async () => {
    if (!agreed) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/venues/${venueId}/accept-terms`, {
        method: "POST",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast(data.error || "Something went wrong. Please try again.", "error")
        setIsSubmitting(false)
        return
      }
      router.push(`/venue/onboard/complete?venueId=${venueId}`)
    } catch {
      showToast("Something went wrong. Please try again.", "error")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-6 pb-24">
      {ToastComponent}
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">Terms and conditions</h1>

      <Card>
        <CardHeader>
          <CardTitle>Nooc – Venue Partner Agreement</CardTitle>
          <CardDescription>
            By creating a Venue account and listing seats on Nooc, you agree to the following:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            className={cn(
              "rounded-md border bg-muted/30 p-4 text-sm",
              "max-h-[60vh] overflow-y-auto"
            )}
          >
            <h3 className="mb-2 font-semibold">Role of Nooc</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Nooc provides a platform to facilitate seat reservations and payments.</li>
              <li>Nooc does not manage your staff or venue operations.</li>
              <li>You retain full control over your space, pricing, and availability.</li>
            </ul>

            <h3 className="mt-4 mb-2 font-semibold">Seat Availability & Reservations</h3>
            <p className="mb-2">You agree to:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Clearly designate which seats or tables are listed on Nooc</li>
              <li>Make reasonable efforts to honor active reservations</li>
              <li>Avoid intentionally overbooking Nooc-listed seats</li>
            </ul>

            <h3 className="mt-4 mb-2 font-semibold">If a Reserved Seat Is Occupied</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Your staff will make reasonable efforts to clear the reserved seat or provide a
                comparable alternative.
              </li>
              <li>
                If the issue cannot be resolved, Nooc may review the situation and issue a refund
                or credit to the user at its discretion.
              </li>
            </ul>

            <h3 className="mt-4 mb-2 font-semibold">Venue Responsibilities</h3>
            <p className="mb-2">You agree to:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Train staff on basic awareness of Nooc reservations</li>
              <li>
                Treat Nooc users as regular patrons, with no obligation to provide additional
                services beyond what is listed
              </li>
              <li>Communicate seating issues promptly and professionally</li>
            </ul>

            <h3 className="mt-4 mb-2 font-semibold">Payments & Payouts</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Payments are processed through Nooc&apos;s payment provider.</li>
              <li>Payouts are issued according to your agreed payout schedule.</li>
              <li>Nooc may withhold or adjust payouts for refunded reservations.</li>
            </ul>

            <h3 className="mt-4 mb-2 font-semibold">Standards & Conduct</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>You will operate your venue in compliance with applicable laws and regulations.</li>
              <li>Repeated failure to honor reservations may result in removal from the platform.</li>
            </ul>

            <h3 className="mt-4 mb-2 font-semibold">Platform Disclaimer</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Nooc is not responsible for venue staffing decisions or operational limitations.</li>
              <li>
                Nooc may suspend or remove venues that materially violate platform expectations.
              </li>
            </ul>

            <p className="mt-4 text-muted-foreground">
              By checking &quot;I Agree&quot;, you confirm that you have read and accept Nooc&apos;s
              full Venue Terms & Conditions.
            </p>
          </div>

          <div className="flex flex-col gap-4 border-t pt-6">
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                disabled={isSubmitting}
                className="mt-0.5 h-4 w-4 rounded border-input"
                aria-describedby="venue-terms-agree-desc"
              />
              <span id="venue-terms-agree-desc" className="text-muted-foreground">
                By checking &quot;I Agree&quot;, you confirm that you have read and accept Nooc&apos;s
                full Venue Terms & Conditions.
              </span>
            </label>
            <Button
              onClick={handleContinue}
              disabled={!agreed || isSubmitting}
              size="lg"
              className="w-full sm:w-auto"
            >
              {isSubmitting ? "Continuing..." : "Continue"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
