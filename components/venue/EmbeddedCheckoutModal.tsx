"use client"

import * as React from "react"
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js"
import { getStripe } from "@/lib/stripe-client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"

interface EmbeddedCheckoutModalProps {
  clientSecret: string | null
  stripeAccountId?: string | null
  onClose: () => void
}

export function EmbeddedCheckoutModal({
  clientSecret,
  stripeAccountId,
  onClose,
}: EmbeddedCheckoutModalProps) {
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
    return () => { cancelled = true }
  }, [stripePromise])

  return (
    <Dialog open={!!clientSecret} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl font-bold tracking-tight">Complete your reservation</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 min-h-[400px]">
          {!clientSecret ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 py-20">
              <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
              <p className="text-sm text-muted-foreground animate-pulse font-medium">Preparing secure checkout...</p>
            </div>
          ) : stripeReady === false ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 py-20 text-center">
              <p className="text-sm font-medium text-muted-foreground">
                Checkout is not configured for this environment. Please add{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>{" "}
                to your deployment settings.
              </p>
              <p className="text-xs text-muted-foreground">You can close this and try again in production.</p>
            </div>
          ) : stripeReady === true ? (
            <EmbeddedCheckoutProvider
              stripe={stripePromise}
              options={{ clientSecret }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          ) : (
            <div className="flex flex-col items-center justify-center h-full space-y-4 py-20">
              <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
              <p className="text-sm text-muted-foreground animate-pulse font-medium">Loading checkout...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
