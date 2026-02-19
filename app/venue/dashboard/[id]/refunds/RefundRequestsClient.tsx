"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/toast"
import { CheckCircle2, Clock3, Receipt, XCircle } from "lucide-react"

type RefundRequest = {
  id: string
  status: string
  requestedAmount: number
  approvedAmount: number | null
  reason: string | null
  createdAt: string | Date
  payment: {
    id: string
    amount: number
    currency: string
    amountRefunded: number
  }
  reservation: {
    id: string
    startAt: string | Date
    endAt: string | Date
  } | null
  user: {
    name: string | null
    email: string | null
  } | null
}

export function RefundRequestsClient({
  venueId,
  refundRequests: initialRefundRequests,
}: {
  venueId: string
  refundRequests: RefundRequest[]
}) {
  const { showToast, ToastComponent } = useToast()
  const [refundRequests, setRefundRequests] = useState(initialRefundRequests)
  const [activeRefund, setActiveRefund] = useState<RefundRequest | null>(null)
  const [mode, setMode] = useState<"full" | "percent" | "amount">("full")
  const [percent, setPercent] = useState("100")
  const [amount, setAmount] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const statusBadge = (status: string) => {
    const base = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
    switch (status) {
      case "REQUESTED":
        return `${base} bg-amber-100 text-amber-700`
      case "APPROVED":
      case "PROCESSING":
        return `${base} bg-blue-100 text-blue-700`
      case "SUCCEEDED":
        return `${base} bg-emerald-100 text-emerald-700`
      case "FAILED":
      case "DECLINED":
        return `${base} bg-red-100 text-red-700`
      default:
        return `${base} bg-muted text-muted-foreground`
    }
  }

  const formatMoney = (value: number, currency: string) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(value / 100)

  const derivedAmount = useMemo(() => {
    if (!activeRefund) return 0
    const refundable = Math.max(
      0,
      activeRefund.payment.amount - activeRefund.payment.amountRefunded
    )
    if (mode === "full") return refundable
    if (mode === "percent") {
      const pct = Number(percent)
      if (!Number.isFinite(pct)) return 0
      return Math.round((pct / 100) * refundable)
    }
    const amt = Math.round(Number(amount) * 100)
    return Number.isFinite(amt) ? amt : 0
  }, [activeRefund, mode, percent, amount])

  const totals = useMemo(() => {
    const pending = refundRequests.filter((r) => r.status === "REQUESTED").length
    const processing = refundRequests.filter((r) =>
      ["APPROVED", "PROCESSING"].includes(r.status)
    ).length
    const completed = refundRequests.filter((r) => r.status === "SUCCEEDED").length
    const totalRequested = refundRequests.reduce((sum, r) => sum + r.requestedAmount, 0)
    const currency = refundRequests[0]?.payment?.currency ?? "usd"
    return { pending, processing, completed, totalRequested, currency }
  }, [refundRequests])

  const approveRefund = async () => {
    if (!activeRefund) return
    if (derivedAmount <= 0) {
      showToast("Enter a valid refund amount.", "error")
      return
    }
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/refunds/${activeRefund.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approvedAmount: derivedAmount,
          full: mode === "full",
          percent: mode === "percent" ? Number(percent) : undefined,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to approve refund.")
      }
      showToast("Refund processed.", "success")
      setRefundRequests((prev) =>
        prev.map((r) =>
          r.id === activeRefund.id
            ? { ...r, status: "SUCCEEDED", approvedAmount: derivedAmount }
            : r
        )
      )
      setActiveRefund(null)
      setAmount("")
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Refund failed.", "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {ToastComponent}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Refund requests</h1>
          <p className="text-sm text-muted-foreground">
            Review and approve refunds for your venue.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-amber-700">
            <Clock3 className="h-3.5 w-3.5" />
            {totals.pending} pending
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-blue-700">
            <Receipt className="h-3.5 w-3.5" />
            {totals.processing} processing
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {totals.completed} completed
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-muted-foreground">
            {formatMoney(totals.totalRequested, totals.currency)} requested
          </span>
        </div>
      </div>

      {refundRequests.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
            <XCircle className="h-5 w-5" />
            No refund requests yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {refundRequests.map((refund) => (
            <Card key={refund.id} className="border-muted/60">
              <CardHeader className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    {refund.user?.name || refund.user?.email || "Guest"}
                  </CardTitle>
                  <span className={statusBadge(refund.status)}>
                    {refund.status.toLowerCase()}
                  </span>
                </div>
                <CardDescription>
                  Requested {formatMoney(refund.requestedAmount, refund.payment.currency)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid gap-1 text-xs text-muted-foreground">
                  <div>
                    Reservation <span className="font-medium text-foreground">{refund.reservation?.id ?? "—"}</span>
                  </div>
                  {refund.reason && (
                    <div>
                      Reason <span className="text-foreground">{refund.reason}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => setActiveRefund(refund)}
                    disabled={refund.status !== "REQUESTED"}
                  >
                    Approve
                  </Button>
                  {refund.reservation ? (
                    <Button size="sm" variant="outline" asChild>
                      <a href={`/reservations/${refund.reservation.id}`}>View reservation</a>
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!activeRefund} onOpenChange={(open) => !open && setActiveRefund(null)}>
        {activeRefund && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approve refund</DialogTitle>
              <DialogDescription>
                Choose how much you want to refund for this reservation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Button
                  variant={mode === "full" ? "default" : "outline"}
                  onClick={() => setMode("full")}
                >
                  Full
                </Button>
                <Button
                  variant={mode === "percent" ? "default" : "outline"}
                  onClick={() => setMode("percent")}
                >
                  %
                </Button>
                <Button
                  variant={mode === "amount" ? "default" : "outline"}
                  onClick={() => setMode("amount")}
                >
                  Amount
                </Button>
              </div>

              {mode === "percent" && (
                <input
                  value={percent}
                  onChange={(event) => setPercent(event.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Percent"
                  type="number"
                  min="1"
                  max="100"
                />
              )}

              {mode === "amount" && (
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Amount in USD"
                  type="number"
                  min="1"
                  step="0.01"
                />
              )}

              <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Refund amount:{" "}
                <span className="font-medium text-foreground">
                  {formatMoney(derivedAmount, activeRefund.payment.currency)}
                </span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setActiveRefund(null)}>
                Cancel
              </Button>
              <Button onClick={approveRefund} disabled={isSubmitting}>
                {isSubmitting ? "Processing..." : "Approve refund"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
