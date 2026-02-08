"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { ArrowRight, ExternalLink } from "lucide-react"

const STRIPE_ONBOARDING_URL = "https://stripe.com/resources/more/merchant-onboarding-explained"

interface StripeConnectClientProps {
  venueId: string
}

export function StripeConnectClient({ venueId }: StripeConnectClientProps) {
  const router = useRouter()
  const { showToast, ToastComponent } = useToast()

  const handleConnectStripe = () => {
    // UI-only stub - NO Stripe API calls
    showToast("Stripe Connect setup is in progress—continue to submit your venue request.", "success")
  }

  const handleNext = () => {
    router.push(`/venue/onboard/terms?venueId=${venueId}`)
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {ToastComponent}
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">Connect payouts with Stripe</h1>

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

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={handleConnectStripe}
              size="lg"
              className="w-full sm:w-auto"
            >
              Connect to Stripe
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
