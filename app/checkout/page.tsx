"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmbeddedCheckoutView } from "@/components/venue/EmbeddedCheckoutView"
import {
  clearEmbeddedCheckout,
  readEmbeddedCheckout,
  type EmbeddedCheckoutPayload,
} from "@/lib/checkout-session-storage"

export default function CheckoutPage() {
  const router = useRouter()
  const [payload, setPayload] = React.useState<EmbeddedCheckoutPayload | null | undefined>(
    undefined
  )

  React.useEffect(() => {
    setPayload(readEmbeddedCheckout())
  }, [])

  const handleClose = React.useCallback(() => {
    const returnTo = payload?.returnTo
    clearEmbeddedCheckout()
    if (returnTo) {
      router.push(returnTo)
    } else {
      router.back()
    }
  }, [payload?.returnTo, router])

  if (payload === undefined) {
    return null
  }

  if (!payload) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background p-6 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          No active checkout session. Please start your reservation again.
        </p>
        <Button className="mt-6 rounded-2xl" onClick={() => router.push("/")}>
          Return home
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between p-6 pb-0">
        <h1 className="text-xl font-bold tracking-tight">Complete your reservation</h1>
        <button
          type="button"
          onClick={handleClose}
          className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Close checkout"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 min-h-[400px]">
        <EmbeddedCheckoutView
          clientSecret={payload.clientSecret}
          stripeAccountId={payload.stripeAccountId}
        />
      </div>
    </div>
  )
}
