"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Loader2, QrCode } from "lucide-react"
import { useToast } from "@/components/ui/toast"

interface Venue {
  id: string
  name: string
  address: string | null
}

interface Seat {
  id: string
  name: string
  tableId: string
  tableName: string
}

interface Table {
  id: string
  name: string
  seatCount: number
  bookingMode?: string
}

interface QRRegistrationFormProps {
  token: string
  venues: Venue[]
  initialVenueId?: string | null
  initialResourceType?: string | null
  initialResourceId?: string | null
}

export function QRRegistrationForm({
  token,
  venues,
  initialVenueId,
  initialResourceType,
  initialResourceId,
}: QRRegistrationFormProps) {
  const router = useRouter()
  const { showToast, ToastComponent } = useToast()
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(
    initialVenueId || (venues.length === 1 ? venues[0].id : null)
  )
  const [resourceType, setResourceType] = useState<"seat" | "table" | "area" | null>(
    (initialResourceType as "seat" | "table" | "area") || null
  )
  const [resourceId, setResourceId] = useState<string>(initialResourceId || "")
  const [seats, setSeats] = useState<Seat[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [isLoadingResources, setIsLoadingResources] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch resources when venue is selected
  useEffect(() => {
    if (!selectedVenueId) {
      setSeats([])
      setTables([])
      // Only clear resourceType/resourceId if venue changed (not on initial load with prefilled values)
      if (!initialVenueId || selectedVenueId !== initialVenueId) {
        setResourceType(null)
        setResourceId("")
      }
      return
    }

    setIsLoadingResources(true)
    setError(null)

    fetch(`/api/venues/${selectedVenueId}/resources`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
          return
        }
        setSeats(data.seats || [])
        setTables(data.tables || [])
        
        // If we have prefilled values and venue matches, restore them after resources load
        if (initialVenueId === selectedVenueId && initialResourceType && initialResourceId) {
          setResourceType(initialResourceType as "seat" | "table" | "area")
          setResourceId(initialResourceId)
        }
      })
      .catch((err) => {
        console.error("Error fetching resources:", err)
        setError("Failed to load venue resources")
      })
      .finally(() => {
        setIsLoadingResources(false)
      })
  }, [selectedVenueId, initialVenueId, initialResourceType, initialResourceId])

  // Clear resourceId when resourceType changes (unless it's the initial value)
  useEffect(() => {
    // Only clear if resourceType actually changed from initial
    if (resourceType !== initialResourceType) {
      setResourceId("")
    }
  }, [resourceType, initialResourceType])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedVenueId || !resourceType) {
      setError("Please select a venue and resource type")
      return
    }

    if (resourceType !== "area" && !resourceId) {
      setError("Please select a resource")
      return
    }

    if (resourceType === "area" && !resourceId.trim()) {
      setError("Please enter an area identifier")
      return
    }

    setIsSubmitting(true)

    try {
      // Use reassign endpoint if QR is already ACTIVE, otherwise use assign
      const endpoint = "/api/qr-assets/assign" // Will check status in backend
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          venueId: selectedVenueId,
          resourceType,
          resourceId: resourceId.trim() || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to assign QR code")
        return
      }

      showToast("QR code assigned successfully", "success")
      
      // Redirect to QR scan page
      router.push(`/q/${token}`)
    } catch (error: any) {
      console.error("Error assigning QR asset:", error)
      setError("Failed to assign QR code. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSubmit =
    selectedVenueId &&
    resourceType &&
    (resourceType === "area" ? resourceId.trim() : resourceId)

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Venue Selection */}
        <div className="space-y-2">
          <Label htmlFor="venue">Venue</Label>
          {venues.length === 1 ? (
            <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm">
              {venues[0].name}
              {venues[0].address && (
                <span className="text-muted-foreground"> • {venues[0].address}</span>
              )}
            </div>
          ) : (
            <select
              id="venue"
              value={selectedVenueId || ""}
              onChange={(e) => setSelectedVenueId(e.target.value || null)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              required
            >
              <option value="">Select a venue</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                  {venue.address && ` • ${venue.address}`}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Resource Type Selection */}
        <div className="space-y-2">
          <Label htmlFor="resourceType">Resource Type</Label>
          <select
            id="resourceType"
            value={resourceType || ""}
            onChange={(e) =>
              setResourceType(
                (e.target.value as "seat" | "table" | "area") || null
              )
            }
            disabled={!selectedVenueId || isLoadingResources}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            required
          >
            <option value="">Select resource type</option>
            <option value="seat">Seat</option>
            <option value="table">Table</option>
            <option value="area">Area</option>
          </select>
        </div>

        {/* Resource Selection */}
        {resourceType && selectedVenueId && (
          <div className="space-y-2">
            <Label htmlFor="resource">
              {resourceType === "seat"
                ? "Seat"
                : resourceType === "table"
                ? "Table"
                : "Area Identifier"}
            </Label>
            {resourceType === "area" ? (
              <Input
                id="resource"
                type="text"
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
                placeholder="Enter area identifier (e.g., 'Main Floor', 'Patio')"
                required
              />
            ) : (
              <>
                <select
                  id="resource"
                  value={resourceId}
                  onChange={(e) => setResourceId(e.target.value)}
                  disabled={isLoadingResources}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  required
                >
                <option value="">Select {resourceType}</option>
                {resourceType === "seat" &&
                  seats.map((seat) => (
                    <option key={seat.id} value={seat.id}>
                      {seat.name} ({seat.tableName})
                    </option>
                  ))}
                {resourceType === "table" &&
                  tables
                    .filter((table) => (table.bookingMode || "individual") === "group")
                    .map((table) => (
                      <option key={table.id} value={table.id}>
                        {table.name} ({table.seatCount} seats)
                      </option>
                    ))}
              </select>
              {resourceType === "seat" && seats.length === 0 && tables.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  This venue only has group tables. Please select "Table" as the resource type.
                </p>
              )}
              {resourceType === "table" &&
                tables.filter((table) => (table.bookingMode || "individual") === "group").length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    This venue only has individual tables. Please select "Seat" as the resource type.
                  </p>
                )}
              </>
            )}
            {isLoadingResources && (
              <p className="text-xs text-muted-foreground">Loading resources...</p>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={!canSubmit || isSubmitting}
          className="w-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Assigning...
            </>
          ) : (
            <>
              <QrCode className="mr-2 h-4 w-4" />
              Assign QR
            </>
          )}
        </Button>
      </form>
      {ToastComponent}
    </>
  )
}
