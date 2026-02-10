"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Download, Printer, Search } from "lucide-react"

export interface VenueResources {
  tables: Array<{ id: string; name: string; bookingMode: string; seatCount: number }>
  seats: Array<{ id: string; name: string; tableId: string; tableName: string }>
}

interface QRCodeOnboardStepProps {
  venueId: string
  resources: VenueResources
  qrTokensByKey: Record<string, string>
  qrLoadingKey: string | null
  onGenerate: (resourceType: "seat" | "table" | "venue", resourceId?: string) => Promise<void>
  onShowModal: (token: string) => void
}

export function QRCodeOnboardStep({
  venueId,
  resources,
  qrTokensByKey,
  qrLoadingKey,
  onGenerate,
  onShowModal,
}: QRCodeOnboardStepProps) {
  const [search, setSearch] = useState("")

  const groupTables = resources.tables.filter((t) => t.bookingMode === "group")
  const seats = resources.seats
  const searchLower = search.trim().toLowerCase()
  const filteredGroupTables = searchLower
    ? groupTables.filter(
        (t) =>
          (t.name || "").toLowerCase().includes(searchLower)
      )
    : groupTables
  const filteredSeats = searchLower
    ? seats.filter(
        (s) =>
          (s.name || "").toLowerCase().includes(searchLower) ||
          (s.tableName || "").toLowerCase().includes(searchLower)
      )
    : seats

  const hasResources = groupTables.length > 0 || seats.length > 0

  return (
    <div className="space-y-6">
      {/* Educational copy */}
      <Card>
        <CardHeader>
          <CardTitle>QR Codes & How Nooc Works in Your Space</CardTitle>
          <CardDescription className="text-base font-normal text-muted-foreground">
            Nooc uses QR codes to connect your physical space to reservations—making it easy for
            customers to discover, understand, and book seats without disrupting your flow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold">You&apos;ll use two types of QR codes, each with a specific role:</h3>
          </div>

          <div>
            <h4 className="text-sm font-medium">Venue QR (Register / Front Window)</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              <strong>Placement:</strong> Cash register, front window, or entrance
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Allows customers to explore your space on Nooc and see available seats or tables. Ideal
              for walk-ins and first-time users.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              <strong>Why it matters:</strong> Introduces Nooc at the point of purchase and turns
              foot traffic into bookings.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium">Seat / Table QR Codes</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              <strong>Placement:</strong> On individual seats or tables
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Each code links to a specific seat or table, letting customers reserve that exact spot.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              <strong>Why it matters:</strong> Clearly shows which seats are reservable and prevents
              confusion.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium">Why QR Codes Matter</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              QR codes are how customers understand and use Nooc in your space. They set expectations,
              reduce staff explanations, and make your Nooc integration feel clear and intentional.
            </p>
          </div>

          <p className="text-sm text-muted-foreground">
            All QR codes can be managed, printed, or ordered directly from your dashboard.
          </p>
        </CardContent>
      </Card>

      {/* Seat / Table QR card */}
      <Card>
        <CardHeader>
          <CardTitle>Seat / Table QR Codes</CardTitle>
          <CardDescription>
            Generate and download QR codes for each table (group booking) or seat (individual
            booking). You can do this anytime from your venue dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasResources && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Filter by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          )}

          <div className="max-h-64 space-y-3 overflow-y-auto rounded-md border bg-muted/30 p-3">
            {/* Venue QR (Register / Front Window) */}
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-muted-foreground">Venue QR (Register / Front Window)</h4>
              <div className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50">
                <span className="min-w-0 truncate text-xs font-medium">
                  Venue QR 
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  {qrTokensByKey["venue"] ? (
                    <>
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        QR assigned
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] px-1.5"
                        onClick={() => onShowModal(qrTokensByKey["venue"])}
                      >
                        <Download className="mr-0.5 h-2.5 w-2.5" />
                        Download
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-1.5"
                      disabled={qrLoadingKey !== null}
                      onClick={() => onGenerate("venue")}
                    >
                      {qrLoadingKey === "venue" ? "..." : <><Printer className="mr-0.5 h-2.5 w-2.5" /> Generate QR</>}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Group tables section */}
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-muted-foreground">Group tables</h4>
                  {filteredGroupTables.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No group-booking tables.</p>
                  ) : (
                    filteredGroupTables.map((table) => {
                      const key = `table:${table.id}`
                      const token = qrTokensByKey[key]
                      const isLoading = qrLoadingKey === key
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
                        >
                          <span className="min-w-0 truncate text-xs font-medium">
                            {table.name || "Unnamed Table"} (group)
                          </span>
                          <div className="flex shrink-0 items-center gap-1">
                            {token ? (
                              <>
                                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                  QR assigned
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[10px] px-1.5"
                                  onClick={() => onShowModal(token)}
                                >
                                  <Download className="mr-0.5 h-2.5 w-2.5" />
                                  Download
                                </Button>
                              </>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px] px-1.5"
                                disabled={qrLoadingKey !== null}
                                onClick={() => onGenerate("table", table.id)}
                              >
                                {isLoading ? "..." : <><Printer className="mr-0.5 h-2.5 w-2.5" /> Generate QR</>}
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Seats (individual booking) section */}
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-muted-foreground">Seats (individual booking)</h4>
                  {filteredSeats.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Seat QR codes appear for tables set to &quot;Book individually&quot;. If you don&apos;t see any
                      seats here, you may have only group-booking tables.
                    </p>
                  ) : (
                    filteredSeats.map((seat) => {
                      const key = `seat:${seat.id}`
                      const token = qrTokensByKey[key]
                      const isLoading = qrLoadingKey === key
                      const rowLabel = `${seat.tableName} — ${seat.name}`
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
                        >
                          <span className="min-w-0 truncate text-xs font-medium" title={rowLabel}>
                            {rowLabel}
                          </span>
                          <div className="flex shrink-0 items-center gap-1">
                            {token ? (
                              <>
                                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                  QR assigned
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[10px] px-1.5"
                                  onClick={() => onShowModal(token)}
                                >
                                  <Download className="mr-0.5 h-2.5 w-2.5" />
                                  Download
                                </Button>
                              </>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px] px-1.5"
                                disabled={qrLoadingKey !== null}
                                onClick={() => onGenerate("seat", seat.id)}
                              >
                                {isLoading ? "..." : <><Printer className="mr-0.5 h-2.5 w-2.5" /> Generate QR</>}
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
        </CardContent>
      </Card>
    </div>
  )
}
