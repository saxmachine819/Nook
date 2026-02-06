"use client"

import { useState, useEffect, useCallback } from "react"
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
import { useToast } from "@/components/ui/toast"
import {
  ExternalLink,
  Download,
  FileImage,
  XCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

interface VenueOption {
  id: string
  name: string
}

interface QRAssetItem {
  id: string
  token: string
  status: string
  batchId: string | null
  venueId: string | null
  venue: { id: string; name: string } | null
  resourceType: string | null
  resourceId: string | null
  reservedOrderId: string | null
  createdAt: string
  activatedAt: string | null
  activatedBy: string | null
  retiredAt: string | null
  lastScannedAt?: string | null
}

interface Summary {
  availableUnregistered: number
  reservedForOrders: number
  active: number
  retired: number
  scansLast24h?: number
  scansLast7d?: number
}

interface ListResponse {
  summary: Summary
  items: QRAssetItem[]
  total: number
  page: number
  pageSize: number
}

interface QRCodesClientProps {
  venues: VenueOption[]
}

export function QRCodesClient({ venues }: QRCodesClientProps) {
  const { showToast, ToastComponent } = useToast()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [items, setItems] = useState<QRAssetItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [createLoading, setCreateLoading] = useState(false)
  const [checkInventoryLoading, setCheckInventoryLoading] = useState(false)
  const [batchCount, setBatchCount] = useState(100)
  const [statusFilter, setStatusFilter] = useState("")
  const [venueFilter, setVenueFilter] = useState("")
  const [batchIdFilter, setBatchIdFilter] = useState("")
  const [reservedFilter, setReservedFilter] = useState("")
  const [showOnlyScanned, setShowOnlyScanned] = useState(false)
  const [retiringToken, setRetiringToken] = useState<string | null>(null)
  const [reassignModal, setReassignModal] = useState<{ token: string } | null>(null)
  const [reassignVenueId, setReassignVenueId] = useState("")
  const [reassignResourceType, setReassignResourceType] = useState<"seat" | "table" | "area">("seat")
  const [reassignResourceId, setReassignResourceId] = useState("")
  const [reassignLoading, setReassignLoading] = useState(false)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("pageSize", String(pageSize))
      if (statusFilter) params.set("status", statusFilter)
      if (venueFilter) params.set("venueId", venueFilter)
      if (batchIdFilter.trim()) params.set("batchId", batchIdFilter.trim())
      if (reservedFilter === "reserved") params.set("reserved", "true")
      if (reservedFilter === "not_reserved") params.set("reserved", "false")
      if (showOnlyScanned) params.set("scannedOnly", "true")
      const res = await fetch(`/api/admin/qr-assets?${params.toString()}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast(data.error || "Failed to load QR assets", "error")
        return
      }
      const data: ListResponse = await res.json()
      setSummary(data.summary)
      setItems(data.items)
      setTotal(data.total)
    } catch {
      showToast("Failed to load QR assets", "error")
    } finally {
      setLoading(false)
    }
  // showToast omitted from deps to avoid re-creating fetchList every render (useToast returns new ref each time)
  }, [page, pageSize, statusFilter, venueFilter, batchIdFilter, reservedFilter, showOnlyScanned])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const handleCreateBatch = async () => {
    const count = Math.min(5000, Math.max(10, batchCount))
    setBatchCount(count)
    setCreateLoading(true)
    try {
      const res = await fetch("/api/admin/qr-assets/batch-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || "Failed to create batch", "error")
        return
      }
      showToast(`Created ${data.created} QR assets (batch ${data.batchId})`, "success")
      fetchList()
    } catch {
      showToast("Failed to create batch", "error")
    } finally {
      setCreateLoading(false)
    }
  }

  const handleCheckInventory = async () => {
    setCheckInventoryLoading(true)
    try {
      const res = await fetch("/api/admin/qr-assets/check-inventory", {
        method: "POST",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || "Failed to check inventory", "error")
        return
      }
      const { availableAfter, replenished, created } = data
      if (replenished && created > 0) {
        showToast(`Available: ${availableAfter}. Replenished: ${created} created.`, "success")
      } else {
        showToast(`Available: ${availableAfter}. No replenishment needed.`, "success")
      }
      fetchList()
    } catch {
      showToast("Failed to check inventory", "error")
    } finally {
      setCheckInventoryLoading(false)
    }
  }

  const handleRetire = async (token: string) => {
    setRetiringToken(token)
    try {
      const res = await fetch("/api/qr-assets/retire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || "Failed to retire", "error")
        return
      }
      showToast("QR asset retired", "success")
      fetchList()
    } catch {
      showToast("Failed to retire", "error")
    } finally {
      setRetiringToken(null)
    }
  }

  const handleReassignSubmit = async () => {
    if (!reassignModal) return
    if (!reassignVenueId || !reassignResourceType) {
      showToast("Venue and resource type required", "error")
      return
    }
    if (reassignResourceType !== "area" && !reassignResourceId.trim()) {
      showToast("Resource ID required for seat/table", "error")
      return
    }
    setReassignLoading(true)
    try {
      const res = await fetch("/api/qr-assets/reassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: reassignModal.token,
          venueId: reassignVenueId,
          resourceType: reassignResourceType,
          resourceId: reassignResourceType === "area" ? null : reassignResourceId.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || "Failed to reassign", "error")
        return
      }
      showToast("Reassigned", "success")
      setReassignModal(null)
      setReassignVenueId("")
      setReassignResourceType("seat")
      setReassignResourceId("")
      fetchList()
    } catch {
      showToast("Failed to reassign", "error")
    } finally {
      setReassignLoading(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const formatDate = (s: string | null) => {
    if (!s) return "—"
    return new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
  }

  return (
    <div className="space-y-6">
      {ToastComponent}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Available (unregistered)</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">{summary?.availableUnregistered ?? "—"}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reserved for orders</CardTitle>
            <CardDescription className="text-xs">
              Temporarily claimed (e.g. during allocate or checkout), not yet assigned to a venue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">{summary?.reservedForOrders ?? "—"}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">{summary?.active ?? "—"}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Retired</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">{summary?.retired ?? "—"}</span>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:max-w-md">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Scans (last 24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">{summary?.scansLast24h ?? "—"}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Scans (last 7d)</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">{summary?.scansLast7d ?? "—"}</span>
          </CardContent>
        </Card>
      </div>

      {/* Create batch */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create new batch</CardTitle>
          <CardDescription>Add unregistered QR assets to inventory (10–5000)</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Count</label>
            <input
              type="number"
              min={10}
              max={5000}
              value={batchCount}
              onChange={(e) => setBatchCount(Math.min(5000, Math.max(10, parseInt(e.target.value, 10) || 10)))}
              className="w-28 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <Button onClick={handleCreateBatch} disabled={createLoading}>
            {createLoading ? "Creating…" : "Create new batch"}
          </Button>
          <Button
            variant="outline"
            onClick={handleCheckInventory}
            disabled={checkInventoryLoading}
          >
            {checkInventoryLoading ? "Checking…" : "Check inventory"}
          </Button>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="UNREGISTERED">UNREGISTERED</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="RETIRED">RETIRED</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Venue</label>
            <select
              value={venueFilter}
              onChange={(e) => { setVenueFilter(e.target.value); setPage(1) }}
              className="min-w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Batch ID</label>
            <input
              type="text"
              placeholder="Optional"
              value={batchIdFilter}
              onChange={(e) => { setBatchIdFilter(e.target.value); setPage(1) }}
              className="w-48 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Reserved</label>
            <select
              value={reservedFilter}
              onChange={(e) => { setReservedFilter(e.target.value); setPage(1) }}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="reserved">Reserved</option>
              <option value="not_reserved">Not reserved</option>
            </select>
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={showOnlyScanned}
              onChange={(e) => { setShowOnlyScanned(e.target.checked); setPage(1) }}
              className="rounded border-input"
            />
            <span className="text-sm">Show only scanned</span>
          </label>
          <Button variant="outline" size="sm" onClick={() => fetchList()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">QR assets</CardTitle>
          <CardDescription>
            {loading ? "Loading…" : `${total} total · page ${page} of ${totalPages}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No assets match filters</p>
          ) : (
            <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">Token</th>
                    <th className="text-left p-2 font-medium">Status</th>
                    <th className="text-left p-2 font-medium">Batch ID</th>
                    <th className="text-left p-2 font-medium">Venue</th>
                    <th className="text-left p-2 font-medium">Resource</th>
                    <th className="text-left p-2 font-medium">Reserved order</th>
                    <th className="text-left p-2 font-medium">Created</th>
                    <th className="text-left p-2 font-medium">Activated</th>
                    <th className="text-left p-2 font-medium">Activated by</th>
                    <th className="text-left p-2 font-medium">Last scanned</th>
                    <th className="text-left p-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="p-2 font-mono text-xs">{a.token}</td>
                      <td className="p-2">
                        <span>{a.status}</span>
                        {a.reservedOrderId && (
                          <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Reserved</span>
                        )}
                      </td>
                      <td className="p-2 text-muted-foreground">{a.batchId ?? "—"}</td>
                      <td className="p-2">{a.venue?.name ?? "—"}</td>
                      <td className="p-2">{a.resourceType ?? "—"} {a.resourceId ? `/ ${a.resourceId}` : ""}</td>
                      <td className="p-2 text-muted-foreground">{a.reservedOrderId ?? "—"}</td>
                      <td className="p-2 text-muted-foreground">{formatDate(a.createdAt)}</td>
                      <td className="p-2 text-muted-foreground">{formatDate(a.activatedAt)}</td>
                      <td className="p-2 text-muted-foreground">{a.activatedBy ?? "—"}</td>
                      <td className="p-2 text-muted-foreground">{a.lastScannedAt ? formatDate(a.lastScannedAt) : "—"}</td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          <Button variant="ghost" size="sm" className="h-7 px-1.5" asChild>
                            <a href={`/q/${a.token}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-1.5" asChild>
                            <a href={`/api/qr-assets/${a.token}/qr-only.svg`} download={`qr-${a.token}.svg`}>
                              <Download className="h-3 w-3" />
                            </a>
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-1.5" asChild>
                            <a href={`/api/qr-assets/${a.token}/sticker.svg`} download={`sticker-${a.token}.svg`}>
                              <FileImage className="h-3 w-3" />
                            </a>
                          </Button>
                          {a.status === "ACTIVE" && a.venueId && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-1.5 text-muted-foreground hover:text-destructive"
                                disabled={retiringToken !== null}
                                onClick={() => window.confirm("Retire this QR?") && handleRetire(a.token)}
                              >
                                {retiringToken === a.token ? "…" : <XCircle className="h-3 w-3" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-1.5"
                                onClick={() => {
                                  setReassignModal({ token: a.token })
                                  setReassignVenueId(a.venueId ?? "")
                                  setReassignResourceType((a.resourceType as "seat" | "table" | "area") || "seat")
                                  setReassignResourceId(a.resourceId ?? "")
                                }}
                              >
                                Reassign
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          )}
          {/* Pagination always visible so users can change page; disabled while loading */}
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={loading || page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={loading || page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reassign modal */}
      <Dialog open={!!reassignModal} onOpenChange={(open) => !open && setReassignModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign QR asset</DialogTitle>
            <DialogDescription>
              Assign this QR to a different venue/resource. Token: {reassignModal?.token}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Venue</label>
              <select
                value={reassignVenueId}
                onChange={(e) => setReassignVenueId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select venue</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Resource type</label>
              <select
                value={reassignResourceType}
                onChange={(e) => setReassignResourceType(e.target.value as "seat" | "table" | "area")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="seat">Seat</option>
                <option value="table">Table</option>
                <option value="area">Area</option>
              </select>
            </div>
            {reassignResourceType !== "area" && (
              <div>
                <label className="mb-1 block text-sm font-medium">Resource ID</label>
                <input
                  type="text"
                  value={reassignResourceId}
                  onChange={(e) => setReassignResourceId(e.target.value)}
                  placeholder="Seat or table ID"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignModal(null)}>Cancel</Button>
            <Button onClick={handleReassignSubmit} disabled={reassignLoading}>
              {reassignLoading ? "Saving…" : "Reassign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
