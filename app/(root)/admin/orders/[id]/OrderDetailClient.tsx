"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Package, ExternalLink, Download } from "lucide-react"

interface OrderDetailClientProps {
  order: {
    id: string
    status: string
    createdAt: string
    contactName: string
    contactEmail: string
    contactPhone: string | null
    shipAddress1: string
    shipAddress2: string | null
    shipCity: string
    shipState: string
    shipPostalCode: string
    shipCountry: string
    shippingNotes: string | null
    trackingCarrier: string | null
    trackingNumber: string | null
    shippedAt: string | null
    deliveredAt: string | null
    venue: { name: string; address: string | null }
    template: { id: string; name: string }
    items: Array<{
      id: string
      label: string
      qrScopeType: string
      designOption: string
      qrAsset: { token: string }
    }>
  }
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    NEW: "New",
    IN_PRODUCTION: "In production",
    SHIPPED: "Shipped",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
  }
  return map[status] ?? status
}

type OrderData = OrderDetailClientProps["order"]

export function OrderDetailClient({ order: initialOrder }: OrderDetailClientProps) {
  const [order, setOrder] = useState<OrderData>(initialOrder)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shipModalOpen, setShipModalOpen] = useState(false)
  const [trackingCarrier, setTrackingCarrier] = useState(initialOrder.trackingCarrier ?? "")
  const [trackingNumber, setTrackingNumber] = useState(initialOrder.trackingNumber ?? "")
  const [shippedAt, setShippedAt] = useState(
    initialOrder.shippedAt ? initialOrder.shippedAt.slice(0, 10) : new Date().toISOString().slice(0, 10)
  )

  // Keep in sync when navigating to a different order
  useEffect(() => {
    setOrder(initialOrder)
  }, [initialOrder.id])

  const patch = async (body: Record<string, unknown>) => {
    setError(null)
    setLoading("patch")
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Update failed")
        return
      }
      setOrder((prev) => ({
        ...prev,
        status: data.status ?? prev.status,
        trackingCarrier: data.trackingCarrier ?? prev.trackingCarrier,
        trackingNumber: data.trackingNumber ?? prev.trackingNumber,
        shippedAt: data.shippedAt != null ? (typeof data.shippedAt === "string" ? data.shippedAt : new Date(data.shippedAt).toISOString()) : prev.shippedAt,
        deliveredAt: data.deliveredAt != null ? (typeof data.deliveredAt === "string" ? data.deliveredAt : new Date(data.deliveredAt).toISOString()) : prev.deliveredAt,
      }))
      setShipModalOpen(false)
    } finally {
      setLoading(null)
    }
  }

  const handleSetInProduction = () => patch({ status: "IN_PRODUCTION" })
  const handleMarkDelivered = () =>
    patch({ status: "DELIVERED", deliveredAt: new Date().toISOString() })
  const handleCancel = () => patch({ status: "CANCELLED" })
  const handleMarkShipped = () => {
    patch({
      status: "SHIPPED",
      trackingCarrier: trackingCarrier.trim() || null,
      trackingNumber: trackingNumber.trim() || null,
      shippedAt: shippedAt ? new Date(shippedAt).toISOString() : new Date().toISOString(),
    })
  }

  const canSetInProduction = order.status === "NEW"
  const canMarkShipped = order.status === "NEW" || order.status === "IN_PRODUCTION"
  const canMarkDelivered = order.status === "SHIPPED"
  const canCancel = order.status === "NEW" || order.status === "IN_PRODUCTION"

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Order {order.id.slice(0, 10)}…</CardTitle>
            </div>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {getStatusLabel(order.status)}
            </span>
          </div>
          <CardDescription>
            {order.venue.name} · {new Date(order.createdAt).toLocaleDateString("en-US")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Shipping */}
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Shipping</h3>
            <div className="space-y-1 text-sm">
              <p>{order.contactName}</p>
              <p className="text-muted-foreground">{order.contactEmail}</p>
              {order.contactPhone && (
                <p className="text-muted-foreground">{order.contactPhone}</p>
              )}
              <p className="text-muted-foreground">
                {order.shipAddress1}
                {order.shipAddress2 ? `, ${order.shipAddress2}` : ""}
              </p>
              <p className="text-muted-foreground">
                {order.shipCity}, {order.shipState} {order.shipPostalCode}
              </p>
              <p className="text-muted-foreground">{order.shipCountry}</p>
              {order.shippingNotes && (
                <p className="text-muted-foreground">{order.shippingNotes}</p>
              )}
            </div>
          </div>

          {/* Template */}
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Template</h3>
            <p className="text-sm">{order.template.name}</p>
          </div>

          {/* Line items */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-muted-foreground">Line items</h3>
              {order.items.length > 0 && (
                <a
                  href={`/api/admin/orders/${order.id}/qr-print.pdf`}
                  download={`order-${order.id}-qr-codes.pdf`}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-primary hover:bg-muted"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download All
                </a>
              )}
            </div>
            <ul className="space-y-3">
              {order.items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-center"
                >
                  <img
                    src={`/api/qr-assets/${item.qrAsset.token}/qr-only.svg`}
                    alt=""
                    className="h-14 w-14 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.label}</p>
                    <span className="inline-block rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {item.designOption === "COUNTER_SIGN"
                        ? "Counter Sign"
                        : item.designOption === "WINDOW_DECAL"
                          ? "Window Decal"
                          : item.designOption === "TABLE_TENT"
                            ? "Table Tent"
                            : item.designOption === "STANDARD_SEAT_QR"
                              ? "Standard Seat QR"
                              : item.qrScopeType}
                    </span>
                  </div>
                  <a
                    href={`/q/${item.qrAsset.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    /q/{item.qrAsset.token}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Tracking (if shipped) */}
          {(order.shippedAt || order.trackingCarrier || order.trackingNumber) && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">Tracking</h3>
              <div className="space-y-1 text-sm text-muted-foreground">
                {order.trackingCarrier && <p>{order.trackingCarrier}</p>}
                {order.trackingNumber && <p>{order.trackingNumber}</p>}
                {order.shippedAt && (
                  <p>Shipped {new Date(order.shippedAt).toLocaleDateString("en-US")}</p>
                )}
                {order.deliveredAt && (
                  <p>Delivered {new Date(order.deliveredAt).toLocaleDateString("en-US")}</p>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 border-t pt-4">
            {canSetInProduction && (
              <Button
                variant="outline"
                size="sm"
                disabled={loading !== null}
                onClick={handleSetInProduction}
              >
                {loading ? "..." : "Set In production"}
              </Button>
            )}
            {canMarkShipped && (
              <Button
                variant="outline"
                size="sm"
                disabled={loading !== null}
                onClick={() => setShipModalOpen(true)}
              >
                Mark shipped
              </Button>
            )}
            {canMarkDelivered && (
              <Button
                variant="outline"
                size="sm"
                disabled={loading !== null}
                onClick={handleMarkDelivered}
              >
                {loading ? "..." : "Mark delivered"}
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={loading !== null}
                onClick={handleCancel}
              >
                {loading ? "..." : "Cancel order"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Mark shipped modal */}
      <Dialog open={shipModalOpen} onOpenChange={setShipModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark as shipped</DialogTitle>
            <DialogDescription>
              Optionally add carrier and tracking number. Shipped date defaults to today.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="carrier">Carrier</Label>
              <Input
                id="carrier"
                value={trackingCarrier}
                onChange={(e) => setTrackingCarrier(e.target.value)}
                placeholder="e.g. USPS, FedEx"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tracking">Tracking number</Label>
              <Input
                id="tracking"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Tracking number"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="shippedAt">Shipped date</Label>
              <Input
                id="shippedAt"
                type="date"
                value={shippedAt}
                onChange={(e) => setShippedAt(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShipModalOpen(false)}>
              Cancel
            </Button>
            <Button disabled={loading !== null} onClick={handleMarkShipped}>
              {loading ? "..." : "Mark shipped"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
