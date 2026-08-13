"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Elements,
  ExpressCheckoutElement,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js"
import type { StripeElementsOptions } from "@stripe/stripe-js"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getStripe } from "@/lib/stripe-client"
import { cn } from "@/lib/utils"

export interface ExpressCheckoutViewProps {
  clientSecret: string
  paymentId: string
  stripeAccountId?: string | null
  amountCents: number
  venueName?: string
  className?: string
  onCancel?: () => void
}

const appearance: StripeElementsOptions["appearance"] = {
  theme: "stripe",
  variables: {
    borderRadius: "12px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    spacingUnit: "4px",
  },
}

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function ExpressCheckoutView(props: ExpressCheckoutViewProps) {
  const stripePromise = React.useMemo(
    () => getStripe(props.stripeAccountId || undefined),
    [props.stripeAccountId]
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

  if (stripeReady === false) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-20 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          Checkout is not configured for this environment. Please add{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
          </code>{" "}
          to your deployment settings.
        </p>
      </div>
    )
  }

  if (stripeReady === null) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          Loading checkout...
        </p>
      </div>
    )
  }

  return (
    <div className={cn("mx-auto w-full max-w-md", props.className)}>
      <Elements
        stripe={stripePromise}
        options={{ clientSecret: props.clientSecret, appearance }}
      >
        <ExpressCheckoutForm {...props} />
      </Elements>
    </div>
  )
}

function ExpressCheckoutForm({
  paymentId,
  amountCents,
  venueName,
  onCancel,
}: ExpressCheckoutViewProps) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()

  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [showCardForm, setShowCardForm] = React.useState(false)
  // null until the Express Checkout Element reports back; false means the device has
  // no wallet available, in which case the card form is the whole experience.
  const [hasWallets, setHasWallets] = React.useState<boolean | null>(null)

  const returnUrl = React.useMemo(() => {
    if (typeof window === "undefined") return ""
    return `${window.location.origin}/checkout/return?payment_id=${encodeURIComponent(paymentId)}`
  }, [paymentId])

  /**
   * Stripe has taken the payment. The booking is only confirmed once the server has
   * seen it, so poll until the payment is marked paid, then go straight to the
   * reservation. The endpoint finalizes on first sight, so this doubles as the
   * fallback if the `payment_intent.succeeded` webhook is slow.
   */
  const waitForConfirmation = React.useCallback(async () => {
    const deadline = Date.now() + 30_000

    while (Date.now() < deadline) {
      try {
        const response = await fetch(
          `/api/payments/express/status?payment_id=${encodeURIComponent(paymentId)}`
        )
        const data = await response.json().catch(() => null)

        if (data?.status === "paid" && data.reservationId) {
          router.replace(`/reservations/${data.reservationId}`)
          return
        }

        if (data?.status === "refunded") {
          setErrorMessage(
            "That seat was no longer available, so your payment was refunded. Please pick another time."
          )
          setIsProcessing(false)
          return
        }

        if (data?.status === "failed") {
          setErrorMessage("Your payment could not be completed. Please try again.")
          setIsProcessing(false)
          return
        }
      } catch {
        // Network blip — keep polling until the deadline.
      }

      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    // Payment went through but confirmation is lagging. Never imply it failed.
    router.replace("/reservations")
  }, [paymentId, router])

  const confirm = React.useCallback(async () => {
    if (!stripe || !elements) return

    setErrorMessage(null)
    setIsProcessing(true)

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    })

    if (error) {
      setErrorMessage(error.message ?? "Something went wrong with your payment.")
      setIsProcessing(false)
      return
    }

    await waitForConfirmation()
  }, [stripe, elements, returnUrl, waitForConfirmation])

  const handleCardSubmit = React.useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      await confirm()
    },
    [confirm]
  )

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Paying</p>
          {venueName && (
            <p className="truncate text-sm font-semibold tracking-tight">{venueName}</p>
          )}
        </div>
        <p className="text-2xl font-bold tracking-tight">{formatUsd(amountCents)}</p>
      </div>

      <ExpressCheckoutElement
        options={{
          // The customer is already signed in, so we have their email for the receipt.
          // Asking again inside the wallet sheet would add a field for nothing.
          emailRequired: false,
          buttonHeight: 52,
          layout: { maxColumns: 1, maxRows: 2 },
          paymentMethods: {
            applePay: "always",
            googlePay: "always",
            link: "auto",
          },
        }}
        onReady={({ availablePaymentMethods }) => {
          const available = Boolean(
            availablePaymentMethods && Object.keys(availablePaymentMethods).length > 0
          )
          setHasWallets(available)
          // No wallet on this device — don't make them hunt for the card form.
          if (!available) setShowCardForm(true)
        }}
        onConfirm={confirm}
      />

      {isProcessing && (
        <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Confirming your reservation...</span>
        </div>
      )}

      {errorMessage && (
        <p role="alert" className="text-sm text-red-600">
          {errorMessage}
        </p>
      )}

      {hasWallets && !showCardForm && (
        <button
          type="button"
          onClick={() => setShowCardForm(true)}
          className="w-full py-2 text-center text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
        >
          Pay another way
        </button>
      )}

      {showCardForm && (
        <form onSubmit={handleCardSubmit} className="space-y-4">
          {hasWallets && (
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium text-muted-foreground">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>
          )}

          <PaymentElement options={{ layout: "tabs" }} />

          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={isProcessing}
            disabled={!stripe || isProcessing}
          >
            {isProcessing ? "Processing..." : `Pay ${formatUsd(amountCents)}`}
          </Button>
        </form>
      )}

      {onCancel && !isProcessing && (
        <button
          type="button"
          onClick={onCancel}
          className="w-full py-1 text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      )}
    </div>
  )
}
