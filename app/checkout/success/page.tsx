import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, ArrowRight, Sparkles, Calendar, MapPin, ReceiptText } from "lucide-react"

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
    <div className="relative min-h-screen overflow-hidden bg-slate-50/50">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.05),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.05),transparent_50%)]" />

      <div className="container relative mx-auto flex min-h-screen items-center justify-center px-4 py-12">
        <Card className="w-full max-w-2xl border-none bg-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-[2.5rem] overflow-hidden">
          <div className="h-3 bg-emerald-500" />

          <CardHeader className="p-8 sm:p-12 pb-6 text-center space-y-6">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 shadow-inner">
              <CheckCircle2 className="h-10 w-10" />
            </div>

            <div className="space-y-2">
              <CardTitle className="text-3xl font-bold tracking-tight text-slate-900">Payment confirmed!</CardTitle>
              <CardDescription className="text-slate-500 text-lg">
                Your reservation at {payment?.venue?.name || "the venue"} is all set.
              </CardDescription>
            </div>

            {payment?.venue?.name && (
              <div className="flex flex-wrap items-center justify-center gap-4">
                <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-50 border border-slate-100 px-4 py-2 text-sm text-slate-600">
                  <MapPin className="h-4 w-4 text-emerald-500" />
                  <span className="font-medium">{payment.venue.name}</span>
                </div>
                {payment.amount && (
                  <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-50 border border-slate-100 px-4 py-2 text-sm text-slate-600">
                    <ReceiptText className="h-4 w-4 text-emerald-500" />
                    <span className="font-medium">${(payment.amount / 100).toFixed(2)} USD</span>
                  </div>
                )}
              </div>
            )}
          </CardHeader>

          <CardContent className="p-8 sm:p-12 pt-0 space-y-10">
            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-widest font-bold text-slate-400">
                <span className="bg-white px-4">Next Steps</span>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-3">
              <div className="group space-y-3">
                <div className="h-1 w-full bg-emerald-500 rounded-full transition-all group-hover:h-1.5" />
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step 1</div>
                <div className="text-sm font-semibold text-slate-900">Payment Verified</div>
                <p className="text-xs text-slate-500 leading-relaxed">Your secure payment has been processed by Stripe.</p>
              </div>
              <div className="group space-y-3">
                <div className="h-1 w-full bg-emerald-500 rounded-full transition-all group-hover:h-1.5" />
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step 2</div>
                <div className="text-sm font-semibold text-slate-900">Spot Reserved</div>
                <p className="text-xs text-slate-500 leading-relaxed">Your selected seat or table is now blocked off just for you.</p>
              </div>
              <div className="group space-y-3">
                <div className="h-1 w-full bg-emerald-500 rounded-full transition-all group-hover:h-1.5" />
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step 3</div>
                <div className="text-sm font-semibold text-slate-900">Check-in Ready</div>
                <p className="text-xs text-slate-500 leading-relaxed">Head to the venue at your booked time and show your digital receipt.</p>
              </div>
            </div>

            <div className="flex flex-col gap-4 pt-4 sm:flex-row">
              <Button asChild size="lg" className="flex-1 rounded-2xl h-14 text-base font-bold shadow-xl shadow-emerald-500/10 transition-all hover:scale-[1.02]">
                <Link href={reservationId ? `/reservations/${reservationId}` : "/reservations"}>
                  View Reservation details
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline" asChild size="lg" className="flex-1 rounded-2xl h-14 text-base font-semibold border-slate-200 hover:bg-slate-50 transition-all">
                <Link href="/venue/dashboard">Go to your dashboard</Link>
              </Button>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-slate-400 font-medium">
              <Sparkles className="h-3 w-3" />
              <span>Enjoy your stay at {payment?.venue?.name || "the nook"}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
