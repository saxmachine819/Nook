"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { DealType, type Deal } from "@prisma/client"
import { generateDescription, generateDefaultTitle } from "@/lib/deal-utils"
import { cn } from "@/lib/utils"

interface DealFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  venueId: string
  deal?: Deal | null
  onSuccess: () => void
}

const DAYS_OF_WEEK = [
  { value: "MON", label: "Monday" },
  { value: "TUE", label: "Tuesday" },
  { value: "WED", label: "Wednesday" },
  { value: "THU", label: "Thursday" },
  { value: "FRI", label: "Friday" },
  { value: "SAT", label: "Saturday" },
  { value: "SUN", label: "Sunday" },
]

export function DealForm({ open, onOpenChange, venueId, deal, onSuccess }: DealFormProps) {
  const [selectedType, setSelectedType] = useState<DealType>(DealType.FREE_ITEM)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Free Item fields
  const [itemName, setItemName] = useState("")
  const [minHours, setMinHours] = useState<number | null>(null)

  // Percent Off fields
  const [percentOff, setPercentOff] = useState<number | null>(null)
  const [appliesTo, setAppliesTo] = useState("")

  // Amount Off fields
  const [amountOff, setAmountOff] = useState<number | null>(null)
  const [minSpend, setMinSpend] = useState<number | null>(null)

  // Time Window fields
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>([])
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [timeWindowDealType, setTimeWindowDealType] = useState<"free" | "percent" | "amount">("free")
  const [timeWindowItemName, setTimeWindowItemName] = useState("")
  const [timeWindowPercentOff, setTimeWindowPercentOff] = useState<number | null>(null)
  const [timeWindowAmountOff, setTimeWindowAmountOff] = useState<number | null>(null)

  // Initialize form when dialog opens or deal changes
  useEffect(() => {
    if (open) {
      if (deal) {
        // Edit mode
        setSelectedType(deal.type)
        setTitle(deal.title)
        setDescription(deal.description)
        const eligibility = (deal.eligibilityJson as any) || {}
        setMinHours(eligibility.minHours || null)
        setItemName(eligibility.itemName || "")
        setPercentOff(eligibility.percentOff || null)
        setAppliesTo(eligibility.appliesTo || "")
        setAmountOff(eligibility.amountOff || null)
        setMinSpend(eligibility.minSpend || null)
        setDaysOfWeek(eligibility.daysOfWeek || [])
        setStartTime(eligibility.startTime || "")
        setEndTime(eligibility.endTime || "")
        if (eligibility.itemName) {
          setTimeWindowDealType("free")
          setTimeWindowItemName(eligibility.itemName)
        } else if (eligibility.percentOff) {
          setTimeWindowDealType("percent")
          setTimeWindowPercentOff(eligibility.percentOff)
        } else if (eligibility.amountOff) {
          setTimeWindowDealType("amount")
          setTimeWindowAmountOff(eligibility.amountOff)
        }
      } else {
        // Create mode - reset form
        setSelectedType(DealType.FREE_ITEM)
        setTitle("")
        setDescription("")
        setItemName("")
        setMinHours(null)
        setPercentOff(null)
        setAppliesTo("")
        setAmountOff(null)
        setMinSpend(null)
        setDaysOfWeek([])
        setStartTime("")
        setEndTime("")
        setTimeWindowDealType("free")
        setTimeWindowItemName("")
        setTimeWindowPercentOff(null)
        setTimeWindowAmountOff(null)
      }
    }
  }, [open, deal])

  // Update description preview when fields change
  useEffect(() => {
    if (!open) return

    const formData: any = {}
    if (selectedType === DealType.FREE_ITEM) {
      formData.itemName = itemName
      formData.minHours = minHours
    } else if (selectedType === DealType.PERCENT_OFF) {
      formData.percentOff = percentOff
      formData.appliesTo = appliesTo
      formData.minHours = minHours
    } else if (selectedType === DealType.AMOUNT_OFF) {
      formData.amountOff = amountOff
      formData.minSpend = minSpend
      formData.minHours = minHours
    } else if (selectedType === DealType.TIME_WINDOW) {
      formData.daysOfWeek = daysOfWeek
      formData.startTime = startTime
      formData.endTime = endTime
      formData.minHours = minHours
      if (timeWindowDealType === "free") {
        formData.itemName = timeWindowItemName
      } else if (timeWindowDealType === "percent") {
        formData.percentOff = timeWindowPercentOff
      } else if (timeWindowDealType === "amount") {
        formData.amountOff = timeWindowAmountOff
      }
    }

    const generatedDesc = generateDescription(selectedType, formData)
    setDescription(generatedDesc)

    // Auto-update title if empty or using default
    if (!title || title === generateDefaultTitle(selectedType, formData)) {
      const defaultTitle = generateDefaultTitle(selectedType, formData)
      setTitle(defaultTitle)
    }
  }, [
    open,
    selectedType,
    itemName,
    minHours,
    percentOff,
    appliesTo,
    amountOff,
    minSpend,
    daysOfWeek,
    startTime,
    endTime,
    timeWindowDealType,
    timeWindowItemName,
    timeWindowPercentOff,
    timeWindowAmountOff,
    title,
  ])

  const handleDayToggle = (day: string) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      // Build eligibilityJson based on type
      let eligibilityJson: any = {}

      if (selectedType === DealType.FREE_ITEM) {
        if (!itemName.trim()) {
          alert("Item name is required")
          setIsSubmitting(false)
          return
        }
        eligibilityJson = {
          itemName: itemName.trim(),
          ...(minHours && { minHours }),
        }
      } else if (selectedType === DealType.PERCENT_OFF) {
        if (!percentOff || percentOff < 1 || percentOff > 100) {
          alert("Percent off must be between 1 and 100")
          setIsSubmitting(false)
          return
        }
        eligibilityJson = {
          percentOff,
          ...(appliesTo.trim() && { appliesTo: appliesTo.trim() }),
          ...(minHours && { minHours }),
        }
      } else if (selectedType === DealType.AMOUNT_OFF) {
        if (!amountOff || amountOff <= 0) {
          alert("Amount off must be greater than 0")
          setIsSubmitting(false)
          return
        }
        eligibilityJson = {
          amountOff,
          ...(minSpend && { minSpend }),
          ...(minHours && { minHours }),
        }
      } else if (selectedType === DealType.TIME_WINDOW) {
        if (daysOfWeek.length === 0) {
          alert("Please select at least one day")
          setIsSubmitting(false)
          return
        }
        if (!startTime || !endTime) {
          alert("Start time and end time are required")
          setIsSubmitting(false)
          return
        }
        eligibilityJson = {
          daysOfWeek,
          startTime,
          endTime,
          ...(minHours && { minHours }),
        }
        if (timeWindowDealType === "free") {
          if (!timeWindowItemName.trim()) {
            alert("Item name is required")
            setIsSubmitting(false)
            return
          }
          eligibilityJson.itemName = timeWindowItemName.trim()
        } else if (timeWindowDealType === "percent") {
          if (!timeWindowPercentOff || timeWindowPercentOff < 1 || timeWindowPercentOff > 100) {
            alert("Percent off must be between 1 and 100")
            setIsSubmitting(false)
            return
          }
          eligibilityJson.percentOff = timeWindowPercentOff
        } else if (timeWindowDealType === "amount") {
          if (!timeWindowAmountOff || timeWindowAmountOff <= 0) {
            alert("Amount off must be greater than 0")
            setIsSubmitting(false)
            return
          }
          eligibilityJson.amountOff = timeWindowAmountOff
        }
      }

      const payload = {
        type: selectedType,
        title: title.trim(),
        description: description.trim(),
        eligibilityJson,
      }

      const url = deal
        ? `/api/venues/${venueId}/deals/${deal.id}`
        : `/api/venues/${venueId}/deals`
      const method = deal ? "PATCH" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save deal")
      }

      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      alert(error.message || "Failed to save deal")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
        <DialogHeader>
          <DialogTitle>{deal ? "Edit Deal" : "Add Deal"}</DialogTitle>
          <DialogDescription>
            Choose a deal type and fill in the details below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Deal Type Selection */}
          <div>
            <label className="mb-3 block text-sm font-medium">Deal Type</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(DealType)
                .filter((type) => type !== DealType.TIME_WINDOW) // Hide time window for now
                .map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedType(type)}
                    className={cn(
                      "rounded-lg border p-3 text-left text-sm transition-colors",
                      selectedType === type
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input bg-background hover:bg-accent"
                    )}
                  >
                    {type.replace(/_/g, " ")}
                  </button>
                ))}
            </div>
          </div>

          {/* Free Item Form */}
          {selectedType === DealType.FREE_ITEM && (
            <div className="space-y-4">
              <div>
                <label htmlFor="itemName" className="mb-1 block text-sm font-medium">
                  Item Name <span className="text-destructive">*</span>
                </label>
                <input
                  id="itemName"
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g., drip coffee, pastry"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="minHours" className="mb-1 block text-sm font-medium">
                  Minimum Hours (optional)
                </label>
                <input
                  id="minHours"
                  type="number"
                  min="1"
                  value={minHours || ""}
                  onChange={(e) => setMinHours(e.target.value ? parseInt(e.target.value, 10) : null)}
                  placeholder="e.g., 2"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          {/* Percent Off Form */}
          {selectedType === DealType.PERCENT_OFF && (
            <div className="space-y-4">
              <div>
                <label htmlFor="percentOff" className="mb-1 block text-sm font-medium">
                  Percent Off <span className="text-destructive">*</span>
                </label>
                <input
                  id="percentOff"
                  type="number"
                  min="1"
                  max="100"
                  value={percentOff || ""}
                  onChange={(e) => setPercentOff(e.target.value ? parseInt(e.target.value, 10) : null)}
                  placeholder="e.g., 20"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="appliesTo" className="mb-1 block text-sm font-medium">
                  Applies To (optional)
                </label>
                <input
                  id="appliesTo"
                  type="text"
                  value={appliesTo}
                  onChange={(e) => setAppliesTo(e.target.value)}
                  placeholder="e.g., all bookings, coffee"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="minHoursPercent" className="mb-1 block text-sm font-medium">
                  Minimum Hours (optional)
                </label>
                <input
                  id="minHoursPercent"
                  type="number"
                  min="1"
                  value={minHours || ""}
                  onChange={(e) => setMinHours(e.target.value ? parseInt(e.target.value, 10) : null)}
                  placeholder="e.g., 2"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          {/* Amount Off Form */}
          {selectedType === DealType.AMOUNT_OFF && (
            <div className="space-y-4">
              <div>
                <label htmlFor="amountOff" className="mb-1 block text-sm font-medium">
                  Amount Off ($) <span className="text-destructive">*</span>
                </label>
                <input
                  id="amountOff"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amountOff || ""}
                  onChange={(e) => setAmountOff(e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="e.g., 5"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="minSpend" className="mb-1 block text-sm font-medium">
                  Minimum Spend ($) (optional)
                </label>
                <input
                  id="minSpend"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={minSpend || ""}
                  onChange={(e) => setMinSpend(e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="e.g., 20"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="minHoursAmount" className="mb-1 block text-sm font-medium">
                  Minimum Hours (optional)
                </label>
                <input
                  id="minHoursAmount"
                  type="number"
                  min="1"
                  value={minHours || ""}
                  onChange={(e) => setMinHours(e.target.value ? parseInt(e.target.value, 10) : null)}
                  placeholder="e.g., 2"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          {/* Time Window Form */}
          {selectedType === DealType.TIME_WINDOW && (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Days of Week <span className="text-destructive">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => handleDayToggle(day.value)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs transition-colors",
                        daysOfWeek.includes(day.value)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input bg-background hover:bg-accent"
                      )}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="startTime" className="mb-1 block text-sm font-medium">
                    Start Time <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="endTime" className="mb-1 block text-sm font-medium">
                    End Time <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Deal Type Within Window <span className="text-destructive">*</span>
                </label>
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="timeWindowDealType"
                      value="free"
                      checked={timeWindowDealType === "free"}
                      onChange={() => setTimeWindowDealType("free")}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">Free item</span>
                  </label>
                  {timeWindowDealType === "free" && (
                    <div className="ml-6">
                      <input
                        type="text"
                        value={timeWindowItemName}
                        onChange={(e) => setTimeWindowItemName(e.target.value)}
                        placeholder="e.g., drip coffee"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                  )}
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="timeWindowDealType"
                      value="percent"
                      checked={timeWindowDealType === "percent"}
                      onChange={() => setTimeWindowDealType("percent")}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">Percent off</span>
                  </label>
                  {timeWindowDealType === "percent" && (
                    <div className="ml-6">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={timeWindowPercentOff || ""}
                        onChange={(e) => setTimeWindowPercentOff(e.target.value ? parseInt(e.target.value, 10) : null)}
                        placeholder="e.g., 20"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                  )}
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="timeWindowDealType"
                      value="amount"
                      checked={timeWindowDealType === "amount"}
                      onChange={() => setTimeWindowDealType("amount")}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">Amount off</span>
                  </label>
                  {timeWindowDealType === "amount" && (
                    <div className="ml-6">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={timeWindowAmountOff || ""}
                        onChange={(e) => setTimeWindowAmountOff(e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="e.g., 5"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label htmlFor="minHoursTimeWindow" className="mb-1 block text-sm font-medium">
                  Minimum Hours (optional)
                </label>
                <input
                  id="minHoursTimeWindow"
                  type="number"
                  min="1"
                  value={minHours || ""}
                  onChange={(e) => setMinHours(e.target.value ? parseInt(e.target.value, 10) : null)}
                  placeholder="e.g., 2"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-medium">
              Title <span className="text-destructive">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short title for display"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          {/* Description Preview */}
          <div>
            <label className="mb-1 block text-sm font-medium">Description Preview</label>
            <div className="rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              {description || "Description will be generated based on your selections"}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : deal ? "Update Deal" : "Create Deal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
