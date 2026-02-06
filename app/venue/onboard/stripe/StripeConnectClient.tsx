"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { ArrowRight } from "lucide-react"

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
