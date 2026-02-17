"use client"

import React, { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Search, X, Package, ChevronRight } from "lucide-react"
import Link from "next/link"

interface OrderListItem {
  id: string
  status: string
  createdAt: string
  venue: { name: string; address: string | null }
  template: { name: string }
  items: Array<{ qrScopeType: string }>
}

interface OrdersClientProps {
  initialOrders: OrderListItem[]
  initialStatus: string
  initialSearch: string
}

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "NEW", label: "New" },
  { value: "IN_PRODUCTION", label: "In production" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
]

function getStatusLabel(status: string): string {
  const opt = STATUS_OPTIONS.find((o) => o.value === status)
  return opt?.label ?? status
}

function getItemsBreakdown(items: Array<{ qrScopeType: string }>): string {
  const store = items.filter((i) => i.qrScopeType === "STORE").length
  const table = items.filter((i) => i.qrScopeType === "TABLE").length
  const seat = items.filter((i) => i.qrScopeType === "SEAT").length
  const parts: string[] = []
  if (store > 0) parts.push(`${store} Store`)
  if (table > 0) parts.push(`${table} Table${table !== 1 ? "s" : ""}`)
  if (seat > 0) parts.push(`${seat} Seat${seat !== 1 ? "s" : ""}`)
  return parts.length ? parts.join(", ") : "0 items"
}

export function OrdersClient({
  initialOrders,
  initialStatus,
  initialSearch,
}: OrdersClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [orders, setOrders] = useState<OrderListItem[]>(initialOrders)
  const [status, setStatus] = useState(initialStatus)
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setOrders(initialOrders)
  }, [initialOrders])

  const updateUrl = (statusVal: string, searchVal: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    if (statusVal) params.set("status", statusVal)
    else params.delete("status")
    if (searchVal.trim()) params.set("search", searchVal.trim())
    else params.delete("search")
    router.push(`/admin/orders?${params.toString()}`)
  }

  useEffect(() => {
    if (status === initialStatus && searchQuery === initialSearch) return
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      updateUrl(status, searchQuery)
    }, 300)
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [status, searchQuery])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const handleClearSearch = () => {
    setSearchQuery("")
    updateUrl(status, "")
  }

  if (orders.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by venue name or address..."
              className="w-full rounded-md border border-input bg-background py-2 pl-10 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className="flex min-h-[40vh] items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="pt-6">
              <p className="text-center text-sm text-muted-foreground">
                {searchQuery || status
                  ? "No orders match your filters."
                  : "No signage orders yet."}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value || "all"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by venue name or address..."
            className="w-full rounded-md border border-input bg-background py-2 pl-10 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="hidden md:grid md:grid-cols-6 gap-4 px-4 py-2 border-b text-xs font-medium text-muted-foreground">
          <div>Order</div>
          <div>Venue</div>
          <div>Created</div>
          <div>Status</div>
          <div>Template</div>
          <div>Items</div>
        </div>
        {orders.map((order) => (
          <Card key={order.id} className="transition-colors hover:bg-accent/30">
            <Link href={`/admin/orders/${order.id}`}>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-6 md:items-center">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="font-mono text-xs truncate" title={order.id}>
                      {order.id.slice(0, 10)}…
                    </span>
                  </div>
                  <div className="text-sm">
                    <p className="font-medium truncate">{order.venue.name}</p>
                    {order.venue.address && (
                      <p className="text-xs text-muted-foreground truncate">
                        {order.venue.address}
                      </p>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(order.createdAt)}
                  </div>
                  <div>
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {getStatusLabel(order.status)}
                    </span>
                  </div>
                  <div className="text-sm truncate">{order.template.name}</div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{getItemsBreakdown(order.items)}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 md:ml-2" />
                  </div>
                </div>
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  )
}
