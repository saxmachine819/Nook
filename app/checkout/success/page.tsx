import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, ArrowRight, Sparkles } from "lucide-react"

interface CheckoutSuccessPageProps {
  searchParams?: { session_id?: string }
}

export default async function CheckoutSuccessPage({ searchParams }: CheckoutSuccessPageProps) {
  const sessionId = searchParams?.session_id
  const payment = sessionId
    ? await prisma.payment.findUnique({
        where: { stripeCheckoutSessionId: sessionId },
        include: { reservation: true, venue: true },
      })
    : null

  const reservationId = payment?.reservationId ?? payment?.reservation?.id ?? null

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-50 via-white to-transparent" />
      <div className="container relative mx-auto flex min-h-screen items-center justify-center px-4 py-12">
        <Card className="w-full max-w-2xl border-emerald-200 bg-white/90 shadow-lg backdrop-blur">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Payment successful</CardTitle>
                <CardDescription>
                  Your booking is being finalized. We&apos;ll confirm it shortly.
                </CardDescription>
              </div>
            </div>
            {payment?.venue?.name && (
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
                <Sparkles className="h-3.5 w-3.5" />
                Venue: <span className="font-medium">{payment.venue.name}</span>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                Step 1
                <div className="text-sm font-medium text-foreground">Payment complete</div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                Step 2
                <div className="text-sm font-medium text-foreground">Reservation created</div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                Step 3
                <div className="text-sm font-medium text-foreground">Confirmation sent</div>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild>
                <Link href={reservationId ? `/reservations/${reservationId}` : "/reservations"}>
                  View reservation
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/venue/dashboard">Go to dashboard</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              If you don&apos;t see your reservation yet, refresh this page in a moment.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
