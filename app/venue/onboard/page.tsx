"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { Plus, Trash2, Search, Upload, X, Image as ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const AVAILABLE_TAGS = [
  "Quiet",
  "Strong Wi-Fi",
  "Outlets",
  "Call-Friendly",
  "Bright",
  "Cozy",
  "Window",
  "Corner",
]

const SEAT_TAGS = [
  "Outlets",
  "Quiet corner",
  "Window",
  "Bright",
  "Call-friendly",
  "Cozy",
]

interface Seat {
  id: string
  label?: string
  position?: number // Position within table (1, 2, 3...)
  pricePerHour: number
  tags: string[]
  imageUrls: string[]
}

interface Table {
  id: string
  name: string
  bookingMode: "group" | "individual"
  defaultPrice: number
  tablePricePerHour?: number // For group bookings
  imageUrls: string[]
  seats: Seat[]
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
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [zipCode, setZipCode] = useState("")
  const [latitude, setLatitude] = useState("")
  const [longitude, setLongitude] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [rulesText, setRulesText] = useState("")
  const [tables, setTables] = useState<Table[]>([
    {
      id: "1",
      name: "",
      bookingMode: "individual",
      defaultPrice: 0,
      imageUrls: [],
      seats: [{ id: "1", position: 1, pricePerHour: 0, tags: [], imageUrls: [] }],
    },
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

  // Upload state
  const [uploadingImages, setUploadingImages] = useState<Set<string>>(new Set())

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  // Load Google Places API script
  useEffect(() => {
    if (!apiKey) {
      setIsLoadingScript(false)
      return
    }

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
  }, [apiKey])

  // Initialize Places Autocomplete
  useEffect(() => {
    if (!autocompleteInputRef.current || isLoadingScript || !window.google?.maps?.places) {
      return
    }

    if (autocompleteRef.current) {
      return
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

      if (place.name) setName(place.name)
      if (place.formatted_address) setAddress(place.formatted_address)

      let streetNumber = ""
      let route = ""
      let cityValue = ""
      let stateValue = ""
      let zipValue = ""

      if (place.address_components) {
        place.address_components.forEach((component: any) => {
          const types = component.types
          if (types.includes("street_number")) streetNumber = component.long_name
          if (types.includes("route")) route = component.long_name
          if (types.includes("locality")) cityValue = component.long_name
          if (types.includes("administrative_area_level_1")) {
            stateValue = component.short_name
          }
          if (types.includes("postal_code")) zipValue = component.long_name
        })
      }

      if (streetNumber || route) {
        setAddress([streetNumber, route].filter(Boolean).join(" "))
      }
      if (cityValue) setCity(cityValue)
      if (stateValue) setState(stateValue)
      if (zipValue) setZipCode(zipValue)

      if (place.geometry?.location) {
        setLatitude(place.geometry.location.lat().toString())
        setLongitude(place.geometry.location.lng().toString())
      }

      if (place.place_id) {
        setGooglePlaceId(place.place_id)
        setIsLoadingPlaceDetails(true)

        try {
          const response = await fetch(`/api/google/place-details?placeId=${place.place_id}`)
          const data = await response.json()

          if (response.ok && data) {
            if (data.location) {
              setLatitude(data.location.latitude.toString())
              setLongitude(data.location.longitude.toString())
            }
            if (data.openingHours) setOpeningHoursJson(data.openingHours)
            if (data.googleMapsUri) setGoogleMapsUrl(data.googleMapsUri)
            if (data.photos && data.photos.length > 0) {
              setAvailablePhotos(data.photos)
              const defaultCount = Math.min(5, Math.max(3, data.photos.length))
              setSelectedPhotoIndices(new Set(Array.from({ length: defaultCount }, (_, i) => i)))
              showToast(`Place details loaded! Found ${data.photos.length} photos.`, "success")
            } else {
              setAvailablePhotos([])
              setSelectedPhotoIndices(new Set())
              showToast("Place details loaded! (No photos available)", "success")
            }
          }
        } catch (error) {
          console.error("Error fetching place details:", error)
        } finally {
          setIsLoadingPlaceDetails(false)
        }
      }
    })
  }, [isLoadingScript, showToast])

  const addTable = () => {
    const defaultPrice = 0
    setTables([
      ...tables,
      {
        id: Date.now().toString(),
        name: "",
        bookingMode: "individual",
        defaultPrice,
        imageUrls: [],
        seats: [{ id: Date.now().toString() + "-1", position: 1, pricePerHour: defaultPrice, tags: [], imageUrls: [] }],
      },
    ])
  }

  const removeTable = (id: string) => {
    if (tables.length > 1) {
      setTables(tables.filter((t) => t.id !== id))
    }
  }

  const updateTable = (id: string, field: keyof Table, value: any) => {
    setTables(
      tables.map((t) => {
        if (t.id !== id) return t
        if (field === "defaultPrice") {
          // Update all seats in this table with new default price (only for individual mode)
          if (t.bookingMode === "individual") {
            return {
              ...t,
              [field]: value,
              seats: t.seats.map((seat) => ({
                ...seat,
                pricePerHour: value,
              })),
            }
          }
          return { ...t, [field]: value }
        }
        if (field === "tablePricePerHour" && t.bookingMode === "group") {
          // Update all seats with table price (for consistency)
          return {
            ...t,
            [field]: value,
            seats: t.seats.map((seat) => ({
              ...seat,
              pricePerHour: value || 0,
            })),
          }
        }
        if (field === "bookingMode") {
          // When switching modes, preserve seat data
          return { ...t, [field]: value }
        }
        return { ...t, [field]: value }
      })
    )
  }

  const updateSeatCount = (tableId: string, count: number) => {
    // Don't allow count less than 1
    if (count < 1) return

    setTables(
      tables.map((table) => {
        if (table.id !== tableId) return table

        const currentCount = table.seats.length
        const defaultPrice = table.bookingMode === "group" 
          ? (table.tablePricePerHour || table.defaultPrice || 0)
          : (table.defaultPrice || 0)

        if (count > currentCount) {
          // Add new seats with auto-assigned positions
          const newSeats: Seat[] = Array.from({ length: count - currentCount }, (_, i) => ({
            id: `${tableId}-${currentCount + i + 1}`,
            position: currentCount + i + 1, // Auto-assign position (1-indexed)
            pricePerHour: defaultPrice,
            tags: [],
            imageUrls: [],
          }))
          return {
            ...table,
            seats: [...table.seats, ...newSeats],
          }
        } else if (count < currentCount) {
          // Remove seats (maintain positions for remaining seats)
          return {
            ...table,
            seats: table.seats.slice(0, count).map((seat, idx) => ({
              ...seat,
              position: idx + 1, // Re-assign positions sequentially
            })),
          }
        }
        return table
      })
    )
  }

  const updateSeat = (tableId: string, seatId: string, field: keyof Seat, value: any) => {
    setTables(
      tables.map((table) => {
        if (table.id !== tableId) return table
        return {
          ...table,
          seats: table.seats.map((seat) =>
            seat.id === seatId ? { ...seat, [field]: value } : seat
          ),
        }
      })
    )
  }

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const toggleSeatTag = (tableId: string, seatId: string, tag: string) => {
    setTables(
      tables.map((table) => {
        if (table.id !== tableId) return table
        return {
          ...table,
          seats: table.seats.map((seat) => {
            if (seat.id !== seatId) return seat
            const tags = seat.tags.includes(tag)
              ? seat.tags.filter((t) => t !== tag)
              : [...seat.tags, tag]
            return { ...seat, tags }
          }),
        }
      })
    )
  }

  const togglePhotoSelection = (index: number) => {
    setSelectedPhotoIndices((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        if (newSet.size < 8) {
          newSet.add(index)
        } else {
          showToast("You can select up to 8 photos", "error")
        }
      }
      return newSet
    })
  }

  const handleImageUpload = async (
    file: File,
    type: "table" | "seat",
    tableId: string,
    seatId?: string
  ) => {
    const uploadKey = `${type}-${tableId}-${seatId || ""}`
    setUploadingImages((prev) => new Set(prev).add(uploadKey))

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", type)
      formData.append("id", seatId || tableId)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Upload failed. Please check your Supabase configuration.")
      }

      if (!data.url) {
        throw new Error("No URL returned from upload")
      }

      if (type === "table") {
        const table = tables.find((t) => t.id === tableId)
        if (table) {
          updateTable(tableId, "imageUrls", [...table.imageUrls, data.url])
        }
      } else if (seatId) {
        const table = tables.find((t) => t.id === tableId)
        const seat = table?.seats.find((s) => s.id === seatId)
        if (seat) {
          updateSeat(tableId, seatId, "imageUrls", [...seat.imageUrls, data.url])
        }
      }

      showToast("Image uploaded successfully", "success")
    } catch (error: any) {
      console.error("Upload error:", error)
      showToast(error.message || "Failed to upload image. Please check your Supabase configuration.", "error")
    } finally {
      setUploadingImages((prev) => {
        const next = new Set(prev)
        next.delete(uploadKey)
        return next
      })
    }
  }


  const removeImage = (
    url: string,
    type: "table" | "seat",
    tableId: string,
    seatId?: string
  ) => {
    if (type === "table") {
      const table = tables.find((t) => t.id === tableId)
      if (table) {
        updateTable(tableId, "imageUrls", table.imageUrls.filter((u) => u !== url))
      }
    } else if (seatId) {
      const seat = tables.find((t) => t.id === tableId)?.seats.find((s) => s.id === seatId)
      if (seat) {
        updateSeat(tableId, seatId, "imageUrls", seat.imageUrls.filter((u) => u !== url))
      }
    }
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

    // Pricing validation is now done per table/seat, not at venue level

    // Validate tables based on booking mode
    const validTables = tables.filter((t) => {
      if (!t.name.trim() || t.seats.length === 0) return false
      
      if (t.bookingMode === "group") {
        // Group mode: require tablePricePerHour
        return t.tablePricePerHour && t.tablePricePerHour > 0
      } else {
        // Individual mode: require all seats have pricePerHour > 0
        return t.seats.every((s) => s.pricePerHour > 0)
      }
    })

    if (validTables.length === 0) {
      showToast("At least one table with name and valid pricing is required", "error")
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
          neighborhood: null,
          city: city.trim() || null,
          state: state.trim() || null,
          zipCode: zipCode.trim() || null,
          latitude: latitude || null,
          longitude: longitude || null,
          hourlySeatPrice: 0, // Deprecated - pricing is now per table/seat
          tags,
          rulesText: rulesText.trim() || null,
          tables: validTables.map((table) => ({
            name: table.name.trim(),
            seatCount: table.seats.length,
            bookingMode: table.bookingMode,
            tablePricePerHour: table.bookingMode === "group" ? table.tablePricePerHour : null,
            imageUrls: table.imageUrls.length > 0 ? table.imageUrls : null,
            seats: table.seats.map((seat, index) => ({
              pricePerHour: seat.pricePerHour,
              position: seat.position ?? index + 1, // Auto-assign position if missing
              label: seat.label?.trim() || null,
              tags: seat.tags.length > 0 ? seat.tags : null,
              imageUrls: seat.imageUrls.length > 0 ? seat.imageUrls : null,
            })),
          })),
          googlePlaceId: googlePlaceId || null,
          googleMapsUrl: googleMapsUrl || null,
          openingHoursJson: openingHoursJson || null,
          googlePhotoRefs:
            availablePhotos.length > 0
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
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">Onboard your venue</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Venue Information Card */}
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
                      placeholder={
                        isLoadingScript
                          ? "Loading..."
                          : isLoadingPlaceDetails
                            ? "Loading place details..."
                            : "Search for your venue or address"
                      }
                      className="w-full rounded-md border border-input bg-background px-10 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    />
                  </div>
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


        {/* Google Places Photos */}
        {(availablePhotos.length > 0 || isLoadingPlaceDetails || googlePlaceId) && (
          <Card>
            <CardHeader>
              <CardTitle>Venue Photos</CardTitle>
              <CardDescription>Select the best interior shots (3–8 photos)</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingPlaceDetails ? (
                <p className="text-sm text-muted-foreground">Loading photos...</p>
              ) : availablePhotos.length === 0 && googlePlaceId ? (
                <p className="text-sm text-muted-foreground">No photos available for this place</p>
              ) : (
                <div className="space-y-3">
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
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tags */}
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

        {/* Rules */}
        <Card>
          <CardHeader>
            <CardTitle>Rules</CardTitle>
            <CardDescription>Venue rules and policies</CardDescription>
          </CardHeader>
          <CardContent>
            <textarea
              id="rulesText"
              rows={4}
              value={rulesText}
              onChange={(e) => setRulesText(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Enter venue rules, policies, or special instructions..."
            />
          </CardContent>
        </Card>

        {/* Tables & Seats Editor */}
        <Card>
          <CardHeader>
            <CardTitle>Tables & Seats</CardTitle>
            <CardDescription>Define your seating layout with per-seat pricing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {tables.map((table, tableIndex) => (
                <div key={table.id} className="space-y-4 rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-4">
                      <div>
                        <label className="mb-2 block text-sm font-medium">
                          Table {tableIndex + 1} Name <span className="text-destructive">*</span>
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

                      {/* Booking Mode Selector */}
                      <div>
                        <label className="mb-2 block text-sm font-medium">
                          Booking Mode <span className="text-destructive">*</span>
                        </label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`booking-mode-${table.id}`}
                              value="group"
                              checked={table.bookingMode === "group"}
                              onChange={(e) => updateTable(table.id, "bookingMode", e.target.value)}
                              className="h-4 w-4"
                            />
                            <span className="text-sm">Book as group</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`booking-mode-${table.id}`}
                              value="individual"
                              checked={table.bookingMode === "individual"}
                              onChange={(e) => updateTable(table.id, "bookingMode", e.target.value)}
                              className="h-4 w-4"
                            />
                            <span className="text-sm">Book individually</span>
                          </label>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {table.bookingMode === "group"
                            ? "Customers book the entire table at once"
                            : "Customers can book individual seats"}
                        </p>
                      </div>

                      {/* Group Mode: Table Price */}
                      {table.bookingMode === "group" && (
                        <div>
                          <label className="mb-2 block text-sm font-medium">
                            Table price per hour ($) <span className="text-destructive">*</span>
                          </label>
                          <input
                            type="number"
                            required
                            min="0"
                            step="0.01"
                            value={table.tablePricePerHour || ""}
                            onChange={(e) =>
                              updateTable(table.id, "tablePricePerHour", parseFloat(e.target.value) || 0)
                            }
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            placeholder="40.00"
                          />
                          <p className="mt-1 text-xs text-muted-foreground">
                            Price for the entire table regardless of seat count
                          </p>
                        </div>
                      )}

                      {/* Individual Mode: Default Price */}
                      {table.bookingMode === "individual" && (
                        <div>
                          <label className="mb-2 block text-sm font-medium">
                            Default price per seat at this table ($)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={table.defaultPrice || ""}
                            onChange={(e) => updateTable(table.id, "defaultPrice", parseFloat(e.target.value) || 0)}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            placeholder="15.00"
                          />
                          <p className="mt-1 text-xs text-muted-foreground">
                            Applies to all seats at this table, but can be overridden per seat
                          </p>
                        </div>
                      )}

                      <div>
                        <label className="mb-2 block text-sm font-medium">
                          Number of Seats <span className="text-destructive">*</span>
                        </label>
                        <input
                          type="number"
                          required
                          value={table.seats.length}
                          onChange={(e) => {
                            const value = e.target.value
                            // Allow empty string temporarily for deletion
                            if (value === "") {
                              // Don't update seats, but allow the input to be empty temporarily
                              // We'll validate on blur/submit
                              return
                            }
                            const numValue = parseInt(value)
                            if (!isNaN(numValue) && numValue >= 1) {
                              updateSeatCount(table.id, numValue)
                            }
                          }}
                          onBlur={(e) => {
                            // On blur, ensure at least 1 seat
                            const value = e.target.value
                            const numValue = parseInt(value)
                            if (value === "" || isNaN(numValue) || numValue < 1) {
                              // Reset to current seat count (or 1 if somehow 0)
                              const currentCount = table.seats.length
                              if (currentCount < 1) {
                                updateSeatCount(table.id, 1)
                              }
                              // Force re-render by triggering onChange with current count
                              e.target.value = currentCount.toString()
                            }
                          }}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </div>

                      {/* Table Photos */}
                      <div>
                        <label className="mb-2 block text-sm font-medium">Table Photos</label>
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleImageUpload(file, "table", table.id)
                              }}
                              className="hidden"
                              id={`table-upload-${table.id}`}
                            />
                            <label
                              htmlFor={`table-upload-${table.id}`}
                              className="flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted"
                            >
                              <Upload className="h-4 w-4" />
                              Upload Photo
                            </label>
                          </div>
                          {table.imageUrls.length > 0 && (
                            <div className="grid grid-cols-3 gap-2">
                              {table.imageUrls.map((url, idx) => (
                                <div key={idx} className="relative aspect-square overflow-hidden rounded-md">
                                  <img src={url} alt={`Table photo ${idx + 1}`} className="h-full w-full object-cover" />
                                  <button
                                    type="button"
                                    onClick={() => removeImage(url, "table", table.id)}
                                    className="absolute right-1 top-1 rounded-full bg-destructive p-1 text-destructive-foreground"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {tables.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removeTable(table.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Seats - Only show for individual booking mode */}
                  {table.bookingMode === "individual" && (
                    <div className="space-y-3 border-t pt-4">
                      <h4 className="text-sm font-medium">Seats</h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {table.seats.map((seat, seatIndex) => (
                        <div
                          key={seat.id}
                          className="space-y-2 rounded-md border p-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              Seat {seat.position ?? seatIndex + 1}
                              {table.bookingMode === "group" && (
                                <span className="ml-2 text-xs text-muted-foreground">(group booking)</span>
                              )}
                            </span>
                          </div>

                          <div>
                            <label className="mb-1 block text-xs text-muted-foreground">
                              Label (optional)
                            </label>
                            <input
                              type="text"
                              value={seat.label || ""}
                              onChange={(e) => updateSeat(table.id, seat.id, "label", e.target.value)}
                              className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              placeholder="Window seat"
                            />
                          </div>

                          {/* Price input - only show for individual mode */}
                          {table.bookingMode === "individual" && (
                            <div>
                              <label className="mb-1 block text-xs text-muted-foreground">
                                Price per hour ($)
                              </label>
                              <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                value={seat.pricePerHour || ""}
                                onChange={(e) =>
                                  updateSeat(table.id, seat.id, "pricePerHour", parseFloat(e.target.value) || 0)
                                }
                                className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              />
                            </div>
                          )}

                          <div>
                            <label className="mb-1 block text-xs text-muted-foreground">
                              Tags
                            </label>
                            <div className="flex flex-wrap gap-1">
                              {SEAT_TAGS.map((tag) => (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => toggleSeatTag(table.id, seat.id, tag)}
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-xs transition-colors",
                                    seat.tags.includes(tag)
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                                  )}
                                >
                                  {tag}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Seat Photos */}
                          <div>
                            <label className="mb-1 block text-xs text-muted-foreground">
                              Photos
                            </label>
                            <div className="space-y-1">
                              <div className="flex gap-1">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) handleImageUpload(file, "seat", table.id, seat.id)
                                  }}
                                  className="hidden"
                                  id={`seat-upload-${seat.id}`}
                                />
                                <label
                                  htmlFor={`seat-upload-${seat.id}`}
                                  className="flex cursor-pointer items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-muted"
                                >
                                  <Upload className="h-3 w-3" />
                                  Upload Photo
                                </label>
                              </div>
                              {seat.imageUrls.length > 0 && (
                                <div className="grid grid-cols-2 gap-1">
                                  {seat.imageUrls.map((url, idx) => (
                                    <div key={idx} className="relative aspect-square overflow-hidden rounded-md">
                                      <img src={url} alt={`Seat photo ${idx + 1}`} className="h-full w-full object-cover" />
                                      <button
                                        type="button"
                                        onClick={() => removeImage(url, "seat", table.id, seat.id)}
                                        className="absolute right-0.5 top-0.5 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                                      >
                                        <X className="h-2.5 w-2.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <Button type="button" variant="outline" onClick={addTable} className="w-full sm:w-auto">
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
