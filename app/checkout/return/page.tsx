"use client"

import React, { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2, AlertCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function CheckoutReturnPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams?.get("session_id")
  const [status, setStatus] = useState<"loading" | "complete" | "open" | "error">("loading")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setStatus("error")
      setErrorMessage("No session ID found in the URL.")
      return
    }

    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/payments/session-status?session_id=${sessionId}`)
        const data = await response.json()

        if (data.status === "complete") {
          setStatus("complete")
          router.replace(`/checkout/success?session_id=${sessionId}`)
        } else if (data.status === "open") {
          setStatus("open")
        } else {
          setStatus("error")
          setErrorMessage("The payment session is not complete.")
        }
      } catch (err) {
        console.error("Error checking session status:", err)
        setStatus("error")
        setErrorMessage("Unable to verify payment status. Please contact support.")
      }
    }

    checkStatus()
  }, [sessionId, router])

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-slate-50">
        <Card className="w-full max-w-md border-red-200 shadow-2xl rounded-3xl overflow-hidden">
          <div className="h-2 bg-red-500" />
          <CardHeader className="pt-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 mb-4">
              <XCircle className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl font-bold">Payment failed or cancelled</CardTitle>
            <CardDescription className="text-sm mt-2">
              {errorMessage || "We couldn't finalize your payment."}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-0 space-y-4">
            <Button className="w-full rounded-2xl h-12 font-semibold shadow-lg shadow-primary/10" onClick={() => router.push("/")}>
              Return to Home
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              If money was deducted from your account, please contact us with your session ID: <code className="bg-muted px-1 rounded">{sessionId?.slice(0, 10)}...</code>
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === "open") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-slate-50">
        <Card className="w-full max-w-md border-amber-200 shadow-2xl rounded-3xl overflow-hidden">
          <div className="h-2 bg-amber-500" />
          <CardHeader className="pt-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 mb-4">
              <AlertCircle className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl font-bold">Payment is still pending</CardTitle>
            <CardDescription className="text-sm mt-2">
              Your payment is being processed by your bank. We&apos;ll confirm your booking as soon as it clears.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-0 space-y-4">
            <Button className="w-full rounded-2xl h-12 font-semibold" onClick={() => router.push("/reservations")}>
              View My Reservations
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center space-y-6 bg-white">
      <div className="relative">
        <Loader2 className="h-16 w-16 animate-spin text-primary/20" />
        <Loader2 className="h-16 w-16 animate-spin text-primary absolute inset-0 [animation-duration:1.5s]" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-lg font-bold tracking-tight">Finalizing your reservation</h2>
        <p className="text-sm text-muted-foreground animate-pulse font-medium">Verifying payment status with Stripe...</p>
      </div>
    </div>
  )
}
