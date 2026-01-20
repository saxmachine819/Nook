"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { Plus, Trash2, Search } from "lucide-react"
import { cn } from "@/lib/utils"

const AVAILABLE_TAGS = [
  "Quiet",
  "Strong Wi-Fi",
  "Outlets",
  "Call-Friendly",
  "Bright",
  "Cozy",
]

interface TableRow {
  id: string
  name: string
  seatCount: number
}

declare global {
  interface Window {
    google: any
  }
}

export default function VenueOnboardPage() {
  const router = useRouter()
  const { showToast, ToastComponent } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingScript, setIsLoadingScript] = useState(true)
  const autocompleteInputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null)

  // Form state
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [neighborhood, setNeighborhood] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [zipCode, setZipCode] = useState("")
  const [latitude, setLatitude] = useState("")
  const [longitude, setLongitude] = useState("")
  const [hourlySeatPrice, setHourlySeatPrice] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [rulesText, setRulesText] = useState("")
  const [tables, setTables] = useState<TableRow[]>([
    { id: "1", name: "", seatCount: 1 },
  ])

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  // Load Google Places API script
  useEffect(() => {
    if (!apiKey) {
      setIsLoadingScript(false)
      return
    }

    // Check if script is already loaded
    if (window.google?.maps?.places) {
      setIsLoadingScript(false)
      return
    }

    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => {
      setIsLoadingScript(false)
    }
    script.onerror = () => {
      console.error("Failed to load Google Maps script")
      setIsLoadingScript(false)
    }
    document.head.appendChild(script)

    return () => {
      // Cleanup
      const existingScript = document.querySelector(
        `script[src*="maps.googleapis.com/maps/api/js"]`
      )
      if (existingScript) {
        // Don't remove on cleanup to avoid reloading
      }
    }
  }, [apiKey])

  // Initialize Places Autocomplete
  useEffect(() => {
    if (!autocompleteInputRef.current || isLoadingScript || !window.google?.maps?.places) {
      return
    }

    if (autocompleteRef.current) {
      return // Already initialized
    }

    autocompleteRef.current = new window.google.maps.places.Autocomplete(
      autocompleteInputRef.current,
      {
        types: ["establishment", "geocode"],
        fields: [
          "name",
          "formatted_address",
          "address_components",
          "geometry",
          "place_id",
        ],
      }
    )

    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current.getPlace()

      if (!place.geometry) {
        showToast("Please select a valid place from the suggestions", "error")
        return
      }

      // Set venue name
      if (place.name) {
        setName(place.name)
      }

      // Set formatted address
      if (place.formatted_address) {
        setAddress(place.formatted_address)
      }

      // Parse address components
      let streetNumber = ""
      let route = ""
      let neighborhoodValue = ""
      let cityValue = ""
      let stateValue = ""
      let zipValue = ""

      if (place.address_components) {
        place.address_components.forEach((component: any) => {
          const types = component.types

          if (types.includes("street_number")) {
            streetNumber = component.long_name
          }
          if (types.includes("route")) {
            route = component.long_name
          }
          if (types.includes("neighborhood") || types.includes("sublocality")) {
            neighborhoodValue = component.long_name
          }
          if (types.includes("locality")) {
            cityValue = component.long_name
          }
          if (types.includes("administrative_area_level_1")) {
            stateValue = component.short_name
          }
          if (types.includes("postal_code")) {
            zipValue = component.long_name
          }
        })
      }

      // Set address fields
      if (streetNumber || route) {
        const fullAddress = [streetNumber, route].filter(Boolean).join(" ")
        setAddress(fullAddress)
      }
      if (neighborhoodValue) {
        setNeighborhood(neighborhoodValue)
      }
      if (cityValue) {
        setCity(cityValue)
      }
      if (stateValue) {
        setState(stateValue)
      }
      if (zipValue) {
        setZipCode(zipValue)
      }

      // Set coordinates
      if (place.geometry?.location) {
        setLatitude(place.geometry.location.lat().toString())
        setLongitude(place.geometry.location.lng().toString())
      }

      showToast("Place details loaded successfully!", "success")
    })
  }, [isLoadingScript, showToast])

  const addTable = () => {
    setTables([...tables, { id: Date.now().toString(), name: "", seatCount: 1 }])
  }

  const removeTable = (id: string) => {
    if (tables.length > 1) {
      setTables(tables.filter((t) => t.id !== id))
    }
  }

  const updateTable = (id: string, field: keyof TableRow, value: string | number) => {
    setTables(
      tables.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    )
  }

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Validation
    if (!name.trim()) {
      showToast("Venue name is required", "error")
      setIsSubmitting(false)
      return
    }

    if (!address.trim()) {
      showToast("Address is required", "error")
      setIsSubmitting(false)
      return
    }

    if (!hourlySeatPrice || parseFloat(hourlySeatPrice) <= 0) {
      showToast("Hourly seat price must be greater than 0", "error")
      setIsSubmitting(false)
      return
    }

    const validTables = tables.filter((t) => t.name.trim() && t.seatCount > 0)
    if (validTables.length === 0) {
      showToast("At least one table with name and seat count is required", "error")
      setIsSubmitting(false)
      return
    }

    try {
      const response = await fetch("/api/venues", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim(),
          neighborhood: neighborhood.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          zipCode: zipCode.trim() || null,
          latitude: latitude || null,
          longitude: longitude || null,
          hourlySeatPrice,
          tags,
          rulesText: rulesText.trim() || null,
          tables: validTables.map((t) => ({
            name: t.name.trim(),
            seatCount: t.seatCount,
          })),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMessage = data.error || "Failed to create venue. Please try again."
        console.error("API Error:", data)
        showToast(errorMessage, "error")
        setIsSubmitting(false)
        return
      }

      showToast("Venue created successfully!", "success")
      setTimeout(() => {
        router.push(`/venue/${data.venue.id}`)
      }, 1000)
    } catch (error) {
      console.error("Error creating venue:", error)
      showToast("An error occurred. Please try again.", "error")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {ToastComponent}
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">
        Onboard your venue
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Venue Information</CardTitle>
            <CardDescription>Search for your venue or enter details manually</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {apiKey && (
                <div>
                  <label htmlFor="place-search" className="mb-2 block text-sm font-medium">
                    Search for your venue <span className="text-muted-foreground">(optional)</span>
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="place-search"
                      ref={autocompleteInputRef}
                      type="text"
                      disabled={isLoadingScript}
                      placeholder={isLoadingScript ? "Loading..." : "Search for your venue or address"}
                      className="w-full rounded-md border border-input bg-background px-10 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Start typing your venue name or address to see suggestions
                  </p>
                </div>
              )}

              <div>
                <label htmlFor="name" className="mb-2 block text-sm font-medium">
                  Venue Name <span className="text-destructive">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="The Cozy Corner"
                />
              </div>
              <div>
                <label htmlFor="address" className="mb-2 block text-sm font-medium">
                  Address <span className="text-destructive">*</span>
                </label>
                <input
                  id="address"
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="123 Main Street"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="neighborhood" className="mb-2 block text-sm font-medium">
                    Neighborhood
                  </label>
                  <input
                    id="neighborhood"
                    type="text"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Downtown"
                  />
                </div>
                <div>
                  <label htmlFor="city" className="mb-2 block text-sm font-medium">
                    City
                  </label>
                  <input
                    id="city"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="San Francisco"
                  />
                </div>
                <div>
                  <label htmlFor="state" className="mb-2 block text-sm font-medium">
                    State
                  </label>
                  <input
                    id="state"
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="CA"
                  />
                </div>
                <div>
                  <label htmlFor="zipCode" className="mb-2 block text-sm font-medium">
                    Zip Code
                  </label>
                  <input
                    id="zipCode"
                    type="text"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="94102"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
            <CardDescription>Set your hourly rate per seat</CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <label htmlFor="hourlySeatPrice" className="mb-2 block text-sm font-medium">
                Price per seat per hour ($) <span className="text-destructive">*</span>
              </label>
              <input
                id="hourlySeatPrice"
                type="number"
                required
                min="0"
                step="0.01"
                value={hourlySeatPrice}
                onChange={(e) => setHourlySeatPrice(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="15.00"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tags</CardTitle>
            <CardDescription>Select trust signals for your space</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    tags.includes(tag)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rules</CardTitle>
            <CardDescription>Venue rules and policies</CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <label htmlFor="rulesText" className="mb-2 block text-sm font-medium">
                Rules & Policies
              </label>
              <textarea
                id="rulesText"
                rows={4}
                value={rulesText}
                onChange={(e) => setRulesText(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Enter venue rules, policies, or special instructions..."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tables & Seats</CardTitle>
            <CardDescription>Define your seating layout</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tables.map((table, index) => (
                <div
                  key={table.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-end"
                >
                  <div className="flex-1">
                    <label className="mb-2 block text-sm font-medium">
                      Table {index + 1} Name <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={table.name}
                      onChange={(e) => updateTable(table.id, "name", e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Table 1"
                    />
                  </div>
                  <div className="sm:w-32">
                    <label className="mb-2 block text-sm font-medium">
                      Seats <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={table.seatCount}
                      onChange={(e) =>
                        updateTable(table.id, "seatCount", parseInt(e.target.value) || 1)
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  {tables.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeTable(table.id)}
                      className="sm:h-10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={addTable}
                className="w-full sm:w-auto"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Table
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4 pb-8">
          <Button type="submit" disabled={isSubmitting} size="lg">
            {isSubmitting ? "Creating..." : "Publish venue"}
          </Button>
        </div>
      </form>
    </div>
  )
}