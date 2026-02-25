"use client"

import { useRouter } from "next/navigation"
import { useState, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { ArrowRight, ExternalLink, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const STRIPE_ONBOARDING_URL = "https://stripe.com/resources/more/merchant-onboarding-explained"

interface StripeConnectClientProps {
  venueId: string
}

export function StripeConnectClient({ venueId }: StripeConnectClientProps) {
  const router = useRouter()
  const { showToast, ToastComponent } = useToast()
  const [isConnecting, setIsConnecting] = useState(false)

  const handleConnectStripe = useCallback(async () => {
    if (isConnecting) return
    setIsConnecting(true)
    try {
      const response = await fetch(`/api/venues/${venueId}/stripe/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnPath: `/venue/onboard/terms?venueId=${venueId}&stripe=return`,
          refreshPath: `/venue/onboard/stripe?venueId=${venueId}&stripe=refresh`,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to start Stripe onboarding.")
      }
      if (!payload?.url) {
        throw new Error("Stripe onboarding link was missing.")
      }
      window.location.assign(payload.url)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Stripe onboarding failed."
      showToast(message, "error")
      setIsConnecting(false)
    }
  }, [venueId, isConnecting, showToast])

  const handleNext = () => {
    router.push(`/venue/onboard/terms?venueId=${venueId}`)
  }

  const steps = [
    { step: 0, label: "Welcome" },
    { step: 1, label: "Venue Info" },
    { step: 2, label: "Photos & Rules" },
    { step: 3, label: "Tables & Seats" },
    { step: 4, label: "QR Codes" },
    { step: 5, label: "Stripe" },
  ]
  const currentStep = 5

  return (
    <div className="container mx-auto px-4 py-6">
      {ToastComponent}
      <h1 className="mb-4 text-3xl font-semibold tracking-tight">Onboard your venue</h1>

      {/* Progress bar: 6 steps, clickable to go back */}
      <div className="mb-6">
        <div className="flex items-center gap-1">
          {steps.map(({ step, label }, i) => {
            const isPast = step < currentStep
            const isCurrent = step === currentStep
            const isFuture = step > currentStep
            const isClickable = step < currentStep
            return (
              <div key={step} className="flex flex-1 items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (isClickable) {
                      if (step === 0) {
                        router.push(`/venue/onboard`)
                      } else if (step === 1) {
                        router.push(`/venue/onboard`)
                      } else if (step === 2) {
                        router.push(`/venue/onboard`)
                      } else if (step === 3) {
                        router.push(`/venue/onboard`)
                      } else if (step === 4) {
                        router.push(`/venue/onboard`)
                      }
                    }
                  }}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 rounded-md px-1 py-2 text-center transition-colors",
                    isClickable && "cursor-pointer hover:bg-muted/60",
                    !isClickable && "cursor-default",
                    (isPast || isCurrent) && "text-primary",
                    isFuture && "text-muted-foreground"
                  )}
                >
                  <span className="text-xs font-medium">{label}</span>
                  <span
                    className={cn(
                      "h-1.5 w-full max-w-12 rounded-full",
                      (isPast || isCurrent) && "bg-primary",
                      isFuture && "bg-muted"
                    )}
                  />
                </button>
                {i < steps.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 w-4 shrink-0 rounded",
                      step < currentStep ? "bg-primary" : "bg-muted"
                    )}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <h2 className="mb-6 text-2xl font-semibold tracking-tight">Connect payouts with Stripe</h2>

      <Card>
        <CardHeader>
          <CardTitle>Stripe Connect</CardTitle>
          <CardDescription>
            Set up automatic payouts for your venue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Customers book seats through Nooc.
            </p>
            <p className="text-sm text-muted-foreground">
              Nooc uses Stripe Connect to send your share of each booking automatically.
            </p>
            <p className="text-sm text-muted-foreground">
              You'll be able to see payouts and manage your account in Stripe.
            </p>
          </div>

          <div className="rounded-md border bg-muted/30 p-4 space-y-4">
            <h3 className="text-sm font-semibold tracking-tight">
              Stripe Connect onboarding (what you'll need)
            </h3>
            <p className="text-sm text-muted-foreground">
              To receive payouts, vendors complete a quick Stripe Connect setup. This is a standard
              identity and banking check used by platforms like Airbnb and Shopify.
            </p>

            <h4 className="text-sm font-semibold text-foreground">
              What you'll need (5–10 minutes)
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Business info</span>
                <ul className="mt-1 ml-4 list-disc space-y-0.5">
                  <li>Legal business name and address</li>
                  <li>Business type (individual, LLC, corporation, nonprofit)</li>
                  <li>Tax classification</li>
                </ul>
              </li>
              <li>
                <span className="font-medium text-foreground">Owner / representative info</span>
                <ul className="mt-1 ml-4 list-disc space-y-0.5">
                  <li>Full legal name</li>
                  <li>Date of birth</li>
                  <li>Home address</li>
                  <li>Last 4 digits of SSN (US)</li>
                </ul>
              </li>
              <li>
                <span className="font-medium text-foreground">Banking</span>
                <ul className="mt-1 ml-4 list-disc space-y-0.5">
                  <li>Bank account and routing number</li>
                </ul>
              </li>
              <li>
                <span className="font-medium text-foreground">Sometimes required</span>
                <ul className="mt-1 ml-4 list-disc space-y-0.5">
                  <li>Government-issued ID</li>
                  <li>Business registration documents</li>
                </ul>
              </li>
            </ul>

            <h4 className="text-sm font-semibold text-foreground">Why this is required</h4>
            <p className="text-sm text-muted-foreground">
              Stripe is a regulated payments processor and must verify identities (KYC/AML) and
              ensure payouts go to the correct entity. All info is handled securely by Stripe.
            </p>

            <h4 className="text-sm font-semibold text-foreground">Approval timing</h4>
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
              <li>Usually instant</li>
              <li>Up to 24–48 hours if review is needed</li>
            </ul>

            <h4 className="text-sm font-semibold text-foreground">After approval</h4>
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
              <li>Start accepting bookings</li>
              <li>Get paid directly to your bank</li>
              <li>Track payouts in your dashboard</li>
            </ul>

            <p className="pt-2 text-sm text-muted-foreground">
              <Link
                href={STRIPE_ONBOARDING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-foreground underline underline-offset-4 hover:no-underline"
              >
                To learn more, click here
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </p>
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50/50 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-amber-900">
              ⚠️ Verification Status is Critical
            </h4>
            <p className="text-sm text-amber-900">
              <strong>Stripe is very strict about verification.</strong> Before closing the Stripe onboarding window, make sure your account has been fully verified. If your Stripe account is not verified, Nooc will not be able to approve your venue.
            </p>
            <p className="text-sm text-amber-900">
              Don&apos;t worry—if your account isn&apos;t verified when you return, we&apos;ll remind you and you&apos;ll be able to easily come back to this page to finish the verification process.
            </p>
            <p className="text-sm text-amber-900">
              Look for confirmation that your account is verified before closing the Stripe window. 
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={handleConnectStripe}
              disabled={isConnecting}
              size="lg"
              className="w-full sm:w-auto"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect to Stripe"
              )}
            </Button>
            <Button
              onClick={handleNext}
              variant="outline"
              size="lg"
              className="w-full sm:w-auto"
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
