import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { XCircle, ArrowLeft, HelpCircle } from "lucide-react"

export default function CheckoutCancelPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-amber-50 via-white to-transparent" />
      <div className="container relative mx-auto flex min-h-screen items-center justify-center px-4 py-12">
        <Card className="w-full max-w-2xl border-amber-200 bg-white/90 shadow-lg backdrop-blur">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Checkout canceled</CardTitle>
                <CardDescription>
                  Your payment was not completed. You can try again anytime.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                Need help?
                <div className="text-sm font-medium text-foreground">
                  <HelpCircle className="mr-1 inline h-4 w-4" />
                  Check your payment method
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                Try again
                <div className="text-sm font-medium text-foreground">
                  You can restart checkout from the venue page.
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild>
                <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Return to explore
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/reservations">View reservations</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              If you believe this is a mistake, please contact support.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
