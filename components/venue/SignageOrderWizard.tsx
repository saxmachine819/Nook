"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { getSeatLabel } from "@/lib/venue-ops"
import { createSignageOrder } from "@/app/venue/dashboard/[id]/actions/signage-order"

export type SignageOrderWizardVenue = {
  id: string
  name: string
  address?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  ownerFirstName?: string | null
  ownerLastName?: string | null
  tables: Array<{
    id: string
    name: string | null
    bookingMode: string | null
    tablePricePerHour: number | null
    seats: Array<{
      id: string
      label: string | null
      position: number | null
      pricePerHour: number
    }>
  }>
}

type Template = {
  id: string
  name: string
  description: string | null
  category: string
  previewImageUrl: string | null
}

interface SignageOrderWizardProps {
  venue: SignageOrderWizardVenue
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function SignageOrderWizard({ venue, open, onOpenChange, onSuccess }: SignageOrderWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [counterSign, setCounterSign] = useState(false)
  const [windowDecal, setWindowDecal] = useState(false)
  const [selectedTableIds, setSelectedTableIds] = useState<Set<string>>(new Set())
  const [selectedSeatIds, setSelectedSeatIds] = useState<Set<string>>(new Set())
  const [tableSearch, setTableSearch] = useState("")
  const [seatSearch, setSeatSearch] = useState("")
  const [expandedTableIds, setExpandedTableIds] = useState<Set<string>>(new Set())
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [lastOrderCounts, setLastOrderCounts] = useState<{
    counterSignCount: number
    windowDecalCount: number
    tableCount: number
    seatCount: number
  } | null>(null)

  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [shipAddress1, setShipAddress1] = useState("")
  const [shipAddress2, setShipAddress2] = useState("")
  const [shipCity, setShipCity] = useState("")
  const [shipState, setShipState] = useState("")
  const [shipPostalCode, setShipPostalCode] = useState("")
  const [shipCountry, setShipCountry] = useState("US")
  const [shippingNotes, setShippingNotes] = useState("")

  const groupTables = venue.tables.filter((t) => t.bookingMode === "group")
  const filteredTables = groupTables.filter((t) =>
    (t.name || "").toLowerCase().includes(tableSearch.toLowerCase().trim())
  )
  const tablesWithSeats = venue.tables.filter((t) => t.bookingMode !== "group" && t.seats.length > 0)
  const hasIndividualSeats = tablesWithSeats.length > 0

  const toggleTable = (id: string) => {
    setSelectedTableIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSeat = (id: string) => {
    setSelectedSeatIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllFilteredTables = () => {
    setSelectedTableIds((prev) => {
      const next = new Set(prev)
      filteredTables.forEach((t) => next.add(t.id))
      return next
    })
  }

  const clearTableSelection = () => setSelectedTableIds(new Set())

  const getFilteredSeats = useCallback(() => {
    const q = seatSearch.toLowerCase().trim()
    if (!q) {
      return tablesWithSeats.map((table) => ({ table, seats: table.seats }))
    }
    return tablesWithSeats
      .map((table) => ({
        table,
        seats: table.seats.filter(
          (s) =>
            getSeatLabel(s).toLowerCase().includes(q) ||
            (table.name || "").toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.seats.length > 0)
  }, [tablesWithSeats, seatSearch])

  const filteredSeatGroups = getFilteredSeats()
  const allFilteredSeatIds = new Set(filteredSeatGroups.flatMap((g) => g.seats.map((s) => s.id)))

  const selectAllFilteredSeats = () => {
    setSelectedSeatIds((prev) => {
      const next = new Set(prev)
      allFilteredSeatIds.forEach((id) => next.add(id))
      return next
    })
  }

  const clearSeatSelection = () => setSelectedSeatIds(new Set())

  const toggleTableExpanded = (id: string) => {
    setExpandedTableIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  useEffect(() => {
    if (open && step === 1 && templates.length === 0) {
      setLoadingTemplates(true)
      fetch("/api/signage-templates")
        .then((r) => r.json())
        .then((data) => {
          if (data.templates) setTemplates(data.templates)
        })
        .finally(() => setLoadingTemplates(false))
    }
  }, [open, step, templates.length])

  useEffect(() => {
    if (open && step === 3) {
      setShipAddress1(venue.address || "")
      setShipCity(venue.city || "")
      setShipState(venue.state || "")
      setShipPostalCode(venue.zipCode || "")
      if (venue.ownerFirstName || venue.ownerLastName) {
        setContactName([venue.ownerFirstName, venue.ownerLastName].filter(Boolean).join(" "))
      }
    }
  }, [open, step, venue.address, venue.city, venue.state, venue.zipCode, venue.ownerFirstName, venue.ownerLastName])

  const resetWizard = () => {
    setStep(1)
    setCounterSign(false)
    setWindowDecal(false)
    setSelectedTableIds(new Set())
    setSelectedSeatIds(new Set())
    setTableSearch("")
    setSeatSearch("")
    setSelectedTemplateId(null)
    setExpandedTableIds(new Set())
    setLastOrderCounts(null)
  }

  const handleClose = (open: boolean) => {
    if (!open) resetWizard()
    onOpenChange(open)
  }

  const totalItems = (counterSign ? 1 : 0) + (windowDecal ? 1 : 0) + selectedTableIds.size + selectedSeatIds.size
  const canSubmit =
    totalItems >= 1 &&
    selectedTemplateId != null &&
    contactName.trim() !== "" &&
    contactEmail.trim() !== "" &&
    shipAddress1.trim() !== "" &&
    shipCity.trim() !== "" &&
    shipState.trim() !== "" &&
    shipPostalCode.trim() !== "" &&
    shipCountry.trim() !== ""

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    const result = await createSignageOrder({
      venueId: venue.id,
      counterSign,
      windowDecal,
      tableTentTableIds: Array.from(selectedTableIds),
      seatQrSeatIds: Array.from(selectedSeatIds),
      templateId: selectedTemplateId!,
      shipping: {
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim() || null,
        shipAddress1: shipAddress1.trim(),
        shipAddress2: shipAddress2.trim() || null,
        shipCity: shipCity.trim(),
        shipState: shipState.trim(),
        shipPostalCode: shipPostalCode.trim(),
        shipCountry: shipCountry.trim(),
        shippingNotes: shippingNotes.trim() || null,
      },
    })
    setSubmitting(false)
    if (result.success) {
      setLastOrderCounts({
        counterSignCount: result.counterSignCount,
        windowDecalCount: result.windowDecalCount,
        tableCount: result.tableCount,
        seatCount: result.seatCount,
      })
      setStep(4)
    } else {
      alert(result.error)
    }
  }

  const handleSuccessClose = () => {
    onSuccess()
    handleClose(false)
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        {step === 4 ? (
          <>
            <DialogHeader>
              <DialogTitle>Order received</DialogTitle>
              <DialogDescription>
                We will fulfill this order shortly, and email you at the email address you provided with shipping updates.
                {lastOrderCounts && (
                  <span className="block mt-1 text-muted-foreground">
                    Counter: {lastOrderCounts.counterSignCount} · Window: {lastOrderCounts.windowDecalCount} · Tables: {lastOrderCounts.tableCount} · Seats: {lastOrderCounts.seatCount}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={handleSuccessClose}>Close</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {step === 1 && "Choose design template"}
                {step === 2 && "Choose items"}
                {step === 3 && "Shipping"}
              </DialogTitle>
              <DialogDescription>
                {step === 1 && "Pick a design theme for your signage. Free (beta)."}
                {step === 2 && "Select which product options to include. At least one required."}
                {step === 3 && "Where should we ship your signage?"}
              </DialogDescription>
            </DialogHeader>

            {step === 1 && (
              <div className="space-y-4 py-2">
                {loadingTemplates ? (
                  <p className="text-sm text-muted-foreground">Loading templates...</p>
                ) : templates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No templates available.</p>
                ) : (
                  <div className="grid gap-2 max-h-64 overflow-y-auto">
                    {templates.map((t) => (
                      <Card
                        key={t.id}
                        className={cn(
                          "cursor-pointer transition-colors",
                          selectedTemplateId === t.id ? "ring-2 ring-primary" : "hover:bg-muted/50"
                        )}
                        onClick={() => setSelectedTemplateId(t.id)}
                      >
                        <CardHeader className="p-3">
                          <div className="flex items-start gap-3">
                            {t.previewImageUrl && (
                              <img
                                src={t.previewImageUrl}
                                alt=""
                                className="h-12 w-12 rounded object-cover shrink-0"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <CardTitle className="text-sm">{t.name}</CardTitle>
                              {t.description && (
                                <CardDescription className="text-xs mt-0.5">{t.description}</CardDescription>
                              )}
                            </div>
                            <input
                              type="radio"
                              name="template"
                              checked={selectedTemplateId === t.id}
                              onChange={() => setSelectedTemplateId(t.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1"
                            />
                          </div>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                )}
                <DialogFooter>
                  <Button onClick={() => setStep(2)} disabled={!selectedTemplateId}>Next</Button>
                </DialogFooter>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Venue-level (one per venue, same QR)</p>
                  <div
                    className={cn(
                      "flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50 cursor-pointer",
                      counterSign && "bg-muted/50"
                    )}
                    onClick={() => setCounterSign((v) => !v)}
                  >
                    <span className="text-xs font-medium truncate min-w-0">Counter Sign (1)</span>
                    <input
                      type="checkbox"
                      checked={counterSign}
                      onChange={() => setCounterSign((v) => !v)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 shrink-0"
                    />
                  </div>
                  <div
                    className={cn(
                      "flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50 cursor-pointer",
                      windowDecal && "bg-muted/50"
                    )}
                    onClick={() => setWindowDecal((v) => !v)}
                  >
                    <span className="text-xs font-medium truncate min-w-0">Window Decal (1)</span>
                    <input
                      type="checkbox"
                      checked={windowDecal}
                      onChange={() => setWindowDecal((v) => !v)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 shrink-0"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Same QR code; different sign designs.</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Table Tent</p>
                  <p className="text-xs text-muted-foreground">Group-booked tables only; individually booked seats are in Seats below.</p>
                  <Input
                    placeholder="Search tables..."
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={selectAllFilteredTables}>
                      Select all (filtered)
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={clearTableSelection}>
                      Clear selection
                    </Button>
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-md border bg-muted/30 p-1 space-y-0.5">
                    {filteredTables.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-2 py-2">No tables match.</p>
                    ) : (
                      filteredTables.map((table) => {
                        const isGroup = table.bookingMode === "group"
                        const seatCount = table.seats?.length ?? 0
                        const sub = isGroup
                          ? `$${table.tablePricePerHour ?? 0}/hr · ${seatCount} seats`
                          : `${seatCount} seat${seatCount !== 1 ? "s" : ""}`
                        return (
                          <div
                            key={table.id}
                            className={cn(
                              "flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50 cursor-pointer",
                              selectedTableIds.has(table.id) && "bg-muted/50"
                            )}
                            onClick={() => toggleTable(table.id)}
                          >
                            <span className="text-xs font-medium truncate min-w-0">
                              {table.name || "Unnamed Table"} · {sub}
                            </span>
                            <input
                              type="checkbox"
                              checked={selectedTableIds.has(table.id)}
                              onChange={() => toggleTable(table.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="h-4 w-4 shrink-0"
                            />
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                {hasIndividualSeats ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Standard Seat QR</p>
                    <Input
                      placeholder="Search seats..."
                      value={seatSearch}
                      onChange={(e) => setSeatSearch(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={selectAllFilteredSeats}>
                        Select all seats (filtered)
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={clearSeatSelection}>
                        Clear selection
                      </Button>
                    </div>
                    <div className="max-h-48 overflow-y-auto rounded-md border bg-muted/30 p-1 space-y-0.5">
                      {filteredSeatGroups.length === 0 ? (
                        <p className="text-xs text-muted-foreground px-2 py-2">No seats match.</p>
                      ) : (
                        filteredSeatGroups.map(({ table, seats }) => {
                          const isExpanded = expandedTableIds.has(table.id)
                          return (
                            <div key={table.id}>
                              <div
                                className={cn(
                                  "flex items-center gap-1 rounded px-2 py-1.5 text-sm hover:bg-muted/50 cursor-pointer"
                                )}
                                onClick={() => toggleTableExpanded(table.id)}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                                )}
                                <span className="text-xs font-medium">{table.name || "Unnamed Table"}</span>
                              </div>
                              {isExpanded &&
                                seats.map((seat) => (
                                  <div
                                    key={seat.id}
                                    className={cn(
                                      "flex items-center justify-between gap-2 rounded px-2 py-1.5 pl-6 text-sm hover:bg-muted/50 cursor-pointer",
                                      selectedSeatIds.has(seat.id) && "bg-muted/50"
                                    )}
                                    onClick={() => toggleSeat(seat.id)}
                                  >
                                    <span className="text-xs font-medium truncate min-w-0">
                                      {getSeatLabel(seat)} — {table.name || "Table"}
                                    </span>
                                    <input
                                      type="checkbox"
                                      checked={selectedSeatIds.has(seat.id)}
                                      onChange={() => toggleSeat(seat.id)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="h-4 w-4 shrink-0"
                                    />
                                  </div>
                                ))}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No individual seats (all tables are group booking).</p>
                )}

                <p className="text-xs text-muted-foreground border-t pt-2">
                  Counter: {counterSign ? "✓" : "—"} · Window: {windowDecal ? "✓" : "—"} · Tables: {selectedTableIds.size} · Seats: {selectedSeatIds.size}
                </p>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                  <Button onClick={() => setStep(3)} disabled={totalItems < 1}>Next</Button>
                </DialogFooter>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 py-2">
                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="contactName">Contact name</Label>
                    <Input
                      id="contactName"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="contactEmail">Email</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="jane@example.com"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="contactPhone">Phone (optional)</Label>
                    <Input
                      id="contactPhone"
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="shipAddress1">Address line 1</Label>
                    <Input
                      id="shipAddress1"
                      value={shipAddress1}
                      onChange={(e) => setShipAddress1(e.target.value)}
                      placeholder="123 Main St"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="shipAddress2">Address line 2 (optional)</Label>
                    <Input
                      id="shipAddress2"
                      value={shipAddress2}
                      onChange={(e) => setShipAddress2(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-2">
                      <Label htmlFor="shipCity">City</Label>
                      <Input
                        id="shipCity"
                        value={shipCity}
                        onChange={(e) => setShipCity(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="shipState">State</Label>
                      <Input
                        id="shipState"
                        value={shipState}
                        onChange={(e) => setShipState(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="shipPostalCode">Postal code</Label>
                    <Input
                      id="shipPostalCode"
                      value={shipPostalCode}
                      onChange={(e) => setShipPostalCode(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="shipCountry">Country</Label>
                    <Input
                      id="shipCountry"
                      value={shipCountry}
                      onChange={(e) => setShipCountry(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="shippingNotes">Shipping notes (optional)</Label>
                    <Textarea
                      id="shippingNotes"
                      value={shippingNotes}
                      onChange={(e) => setShippingNotes(e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                  <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
                    {submitting ? "Submitting..." : "Submit order"}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
