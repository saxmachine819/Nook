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
  
  // Google Places enrichment state
  const [googlePlaceId, setGooglePlaceId] = useState<string | null>(null)
  const [googleMapsUrl, setGoogleMapsUrl] = useState<string | null>(null)
  const [openingHoursJson, setOpeningHoursJson] = useState<any>(null)
  const [availablePhotos, setAvailablePhotos] = useState<Array<{
    photoUrl: string
    photoReference: string | null
    name: string
  }>>([])
  const [selectedPhotoIndices, setSelectedPhotoIndices] = useState<Set<number>>(new Set())
  const [isLoadingPlaceDetails, setIsLoadingPlaceDetails] = useState(false)

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

    autocompleteRef.current.addListener("place_changed", async () => {
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

      // Fetch enriched place details (photos, opening hours) if place_id is available
      if (place.place_id) {
        setGooglePlaceId(place.place_id)
        setIsLoadingPlaceDetails(true)
        
        try {
          console.log("Fetching place details for:", place.place_id)
          const response = await fetch(`/api/google/place-details?placeId=${place.place_id}`)
          const data = await response.json()

          console.log("Place details response:", { ok: response.ok, data })

          if (response.ok && data) {
            // Update coordinates if provided
            if (data.location) {
              setLatitude(data.location.latitude.toString())
              setLongitude(data.location.longitude.toString())
            }

            // Store opening hours
            if (data.openingHours) {
              setOpeningHoursJson(data.openingHours)
              console.log("Opening hours loaded:", data.openingHours)
            }
            // If no hours are provided, clear any previous hours so UI matches the selected place
            if (!data.openingHours) {
              setOpeningHoursJson(null)
            }

            // Store Google Maps URL
            if (data.googleMapsUri) {
              setGoogleMapsUrl(data.googleMapsUri)
            }

            // Set available photos
            if (data.photos && data.photos.length > 0) {
              console.log("Photos loaded:", data.photos.length)
              setAvailablePhotos(data.photos)
              // Auto-select first 3-5 photos as default (reasonable selection)
              const defaultCount = Math.min(5, Math.max(3, data.photos.length))
              setSelectedPhotoIndices(new Set(Array.from({ length: defaultCount }, (_, i) => i)))
              showToast(`Place details loaded! Found ${data.photos.length} photos.`, "success")
            } else {
              console.log("No photos found for this place")
              setAvailablePhotos([])
              setSelectedPhotoIndices(new Set())
              showToast("Place details loaded! (No photos available for this place)", "success")
            }
          } else {
            console.error("Failed to fetch place details:", data.error, data.details)
            showToast("Basic info loaded, but couldn't fetch photos/hours", "error")
          }
        } catch (error) {
          console.error("Error fetching place details:", error)
          showToast("Basic info loaded, but couldn't fetch photos/hours", "error")
        } finally {
          setIsLoadingPlaceDetails(false)
        }
      } else {
        showToast("Place details loaded successfully!", "success")
      }
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

  const togglePhotoSelection = (index: number) => {
    setSelectedPhotoIndices((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        // Limit to 8 photos max
        if (newSet.size < 8) {
          newSet.add(index)
        } else {
          showToast("You can select up to 8 photos", "error")
        }
      }
      return newSet
    })
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
          // Google Places enrichment fields
          googlePlaceId: googlePlaceId || null,
          googleMapsUrl: googleMapsUrl || null,
          openingHoursJson: openingHoursJson || null,
          googlePhotoRefs: availablePhotos.length > 0
            ? availablePhotos.map((photo) => ({
                name: photo.name,
                photoReference: photo.photoReference,
              }))
            : null,
          heroImageUrl:
            selectedPhotoIndices.size > 0
              ? availablePhotos[Array.from(selectedPhotoIndices)[0]]?.photoUrl || null
              : null,
          imageUrls:
            selectedPhotoIndices.size > 0
              ? Array.from(selectedPhotoIndices)
                  .map((idx) => availablePhotos[idx]?.photoUrl)
                  .filter(Boolean)
              : null,
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
                    Find on Google <span className="text-muted-foreground">(optional)</span>
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="place-search"
                      ref={autocompleteInputRef}
                      type="text"
                      disabled={isLoadingScript || isLoadingPlaceDetails}
                      placeholder={isLoadingScript ? "Loading..." : isLoadingPlaceDetails ? "Loading place details..." : "Search for your venue or address"}
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

        {/* Google Places Photos */}
        {(availablePhotos.length > 0 || isLoadingPlaceDetails || googlePlaceId) && (
          <Card>
            <CardHeader>
              <CardTitle>Photos</CardTitle>
              <CardDescription>
                Select the best interior shots (3–8 photos)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingPlaceDetails ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Loading photos and place details...</p>
                  <p className="text-xs text-muted-foreground">This may take a few seconds</p>
                </div>
              ) : availablePhotos.length === 0 && googlePlaceId ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">No photos available for this place</p>
                  <p className="text-xs text-muted-foreground">You can still create the venue without photos</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Select the best interior shots. We cannot guarantee interior-only photos.
                  </p>
                  {/* Smaller tiles: more columns + tighter gap */}
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
                    {availablePhotos.map((photo, index) => {
                      const isSelected = selectedPhotoIndices.has(index)
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => togglePhotoSelection(index)}
                          className={cn(
                            "group relative aspect-square overflow-hidden rounded-lg border-2 transition-all",
                            isSelected
                              ? "border-primary ring-2 ring-primary ring-offset-2"
                              : "border-muted hover:border-primary/50"
                          )}
                        >
                          <img
                            src={photo.photoUrl}
                            alt={`Venue photo ${index + 1}`}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              // Fallback if image fails to load
                              ;(e.target as HTMLImageElement).style.display = "none"
                            }}
                          />
                          {isSelected && (
                            <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                <span className="text-xs font-semibold">
                                  {Array.from(selectedPhotoIndices).indexOf(index) + 1}
                                </span>
                              </div>
                            </div>
                          )}
                          {!isSelected && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/10">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                                <Plus className="h-3.5 w-3.5 text-white" />
                              </div>
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  {selectedPhotoIndices.size > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {selectedPhotoIndices.size} photo{selectedPhotoIndices.size > 1 ? "s" : ""} selected
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Google Places Hours */}
        {(isLoadingPlaceDetails || googlePlaceId) && (
          <Card>
            <CardHeader>
              <CardTitle>Hours</CardTitle>
              <CardDescription>From Google (optional)</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingPlaceDetails ? (
                <p className="text-sm text-muted-foreground">Loading hours…</p>
              ) : openingHoursJson?.weekdayDescriptions?.length ? (
                <div className="space-y-1">
                  {openingHoursJson.weekdayDescriptions.map((line: string) => (
                    <p key={line} className="text-sm text-muted-foreground">
                      {line}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No hours available for this place.
                </p>
              )}
            </CardContent>
          </Card>
        )}

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