"use client"

import * as React from "react"
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js"
import { getStripe } from "@/lib/stripe-client"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmbeddedCheckoutViewProps {
  clientSecret: string
  stripeAccountId?: string | null
  className?: string
}

export function EmbeddedCheckoutView({
  clientSecret,
  stripeAccountId,
  className,
}: EmbeddedCheckoutViewProps) {
  const stripePromise = React.useMemo(
    () => getStripe(stripeAccountId || undefined),
    [stripeAccountId]
  )
  const [stripeReady, setStripeReady] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    let cancelled = false
    stripePromise.then((stripe) => {
      if (!cancelled) setStripeReady(stripe !== null)
    })
    return () => {
      cancelled = true
    }
  }, [stripePromise])

  return (
    <div className={cn("min-h-[400px]", className)}>
      {stripeReady === false ? (
        <div className="flex flex-col items-center justify-center h-full space-y-4 py-20 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            Checkout is not configured for this environment. Please add{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
            </code>{" "}
            to your deployment settings.
          </p>
          <p className="text-xs text-muted-foreground">
            You can close this and try again in production.
          </p>
        </div>
      ) : stripeReady === true ? (
        <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      ) : (
        <div className="flex flex-col items-center justify-center h-full space-y-4 py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
          <p className="text-sm text-muted-foreground animate-pulse font-medium">
            Loading checkout...
          </p>
        </div>
      )}
    </div>
  )
}
