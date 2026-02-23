"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { Plus, Trash2, Search, Upload, X, Image as ImageIcon, Expand, ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { ImageGalleryModal } from "@/components/ui/ImageGalleryModal"
import { WelcomeOnboardStep } from "./WelcomeOnboardStep"
import { QRCodeOnboardStep } from "./QRCodeOnboardStep"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
  directionsText: string
  seats: Seat[]
}

declare global {
  interface Window {
    google: any
  }
}

const splitName = (name: string | null | undefined): [string, string] => {
  const parts = name?.trim().split(/\s+/) ?? []
  return [parts[0] ?? "", parts.slice(1).join(" ") ?? ""]
}

interface VenueOnboardClientProps {
  initialOwnerName?: string | null
}

export function VenueOnboardClient({ initialOwnerName }: VenueOnboardClientProps = {}) {
  const router = useRouter()
  const { showToast, ToastComponent } = useToast()
  const [currentStep, setCurrentStep] = useState<0 | 1 | 2 | 3 | 4>(0)
  const [expandedTableId, setExpandedTableId] = useState<string | null>(null) // null + single table => that table expanded
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingScript, setIsLoadingScript] = useState(true)
  const autocompleteInputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null)
  const venuePhotoInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [zipCode, setZipCode] = useState("")
  const [latitude, setLatitude] = useState("")
  const [longitude, setLongitude] = useState("")
  const [ownerFirstName, setOwnerFirstName] = useState(() => splitName(initialOwnerName)[0])
  const [ownerLastName, setOwnerLastName] = useState(() => splitName(initialOwnerName)[1])
  const [ownerPhone, setOwnerPhone] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [rulesText, setRulesText] = useState("")
  const [tables, setTables] = useState<Table[]>([
    {
      id: "1",
      name: "",
      bookingMode: "individual",
      defaultPrice: 0,
      imageUrls: [],
      directionsText: "",
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
  const [ownerUploadedUrls, setOwnerUploadedUrls] = useState<string[]>([])
  const [selectedCatalogIndices, setSelectedCatalogIndices] = useState<number[]>([])
  const [isLoadingPlaceDetails, setIsLoadingPlaceDetails] = useState(false)

  // Catalog = Google photos + owner uploads (ordered: Google first, then uploads)
  const catalog: Array<
    | { source: "google"; photoUrl: string; photoReference: string | null; name: string; indexInGoogle: number }
    | { source: "upload"; photoUrl: string }
  > = [
    ...availablePhotos.map((p, i) => ({ source: "google" as const, photoUrl: p.photoUrl, photoReference: p.photoReference, name: p.name, indexInGoogle: i })),
    ...ownerUploadedUrls.map((url) => ({ source: "upload" as const, photoUrl: url })),
  ]

  // Upload state
  const [uploadingImages, setUploadingImages] = useState<Set<string>>(new Set())
  const [uploadingVenuePhoto, setUploadingVenuePhoto] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0)

  // QR Codes step (after Tables & Seats)
  const [draftVenueId, setDraftVenueId] = useState<string | null>(null)
  const [venueResources, setVenueResources] = useState<{
    tables: Array<{ id: string; name: string; bookingMode: string; seatCount: number }>
    seats: Array<{ id: string; name: string; tableId: string; tableName: string }>
  } | null>(null)
  const [qrTokensByKey, setQrTokensByKey] = useState<Record<string, string>>({})
  const [qrLoadingKey, setQrLoadingKey] = useState<string | null>(null)
  const [qrModalToken, setQrModalToken] = useState<string | null>(null)

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
      // Yield so window.google is set before we mark script ready (avoids init race)
      setTimeout(() => setIsLoadingScript(false), 0)
    }
    script.onerror = () => {
      console.error("Failed to load Google Maps script")
      setIsLoadingScript(false)
    }
    document.head.appendChild(script)
  }, [apiKey])

  // Initialize Places Autocomplete (retry briefly if script just loaded and google isn't ready yet)
  const [autocompleteRetry, setAutocompleteRetry] = useState(0)
  useEffect(() => {
    if (!autocompleteInputRef.current || isLoadingScript) {
      return
    }
    if (!window.google?.maps?.places) {
      if (apiKey && autocompleteRetry < 3) {
        const t = setTimeout(() => setAutocompleteRetry((n) => n + 1), 300)
        return () => clearTimeout(t)
      }
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
              setSelectedCatalogIndices(Array.from({ length: defaultCount }, (_, i) => i))
              // showToast(`Place details loaded! Found ${data.photos.length} photos.`, "success") // May want to bring back
            } else {
              setAvailablePhotos([])
              setSelectedCatalogIndices([])
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
  }, [apiKey, isLoadingScript, showToast, autocompleteRetry])

  const addTable = () => {
    const defaultPrice = 0
    const newId = Date.now().toString()
    setTables([
      ...tables,
      {
        id: newId,
        name: "",
        bookingMode: "individual",
        defaultPrice,
        imageUrls: [],
        directionsText: "",
        seats: [{ id: newId + "-1", position: 1, pricePerHour: defaultPrice, tags: [], imageUrls: [] }],
      },
    ])
    setExpandedTableId(newId) // Expand new table and collapse others
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

  const toggleCatalogPhotoSelection = (catalogIndex: number) => {
    setSelectedCatalogIndices((prev) => {
      const idx = prev.indexOf(catalogIndex)
      if (idx >= 0) {
        return prev.filter((i) => i !== catalogIndex)
      }
      if (prev.length >= 8) {
        showToast("You can select up to 8 photos", "error")
        return prev
      }
      return [...prev, catalogIndex]
    })
  }

  const handleVenuePhotoUpload = async (file: File) => {
    setUploadingVenuePhoto(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", "venue")
      formData.append("id", "draft")
      const response = await fetch("/api/upload", { method: "POST", body: formData })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Upload failed.")
      if (!data.url) throw new Error("No URL returned from upload")
      setOwnerUploadedUrls((prev) => (prev.includes(data.url) ? prev : [...prev, data.url]))
      showToast("Image uploaded successfully", "success")
    } catch (err: any) {
      showToast(err.message || "Failed to upload image.", "error")
    } finally {
      setUploadingVenuePhoto(false)
    }
  }

  const removeOwnerUpload = (url: string) => {
    const idx = ownerUploadedUrls.indexOf(url)
    if (idx < 0) return
    const catalogIndexToRemove = availablePhotos.length + idx
    setOwnerUploadedUrls((prev) => prev.filter((u) => u !== url))
    setSelectedCatalogIndices((prev) =>
      prev.filter((i) => i !== catalogIndexToRemove).map((i) => (i > catalogIndexToRemove ? i - 1 : i))
    )
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

  // Validation helper function
  const validateForm = (): boolean => {
    if (!name.trim()) {
      showToast("Venue name is required", "error")
      return false
    }

    if (!address.trim()) {
      showToast("Address is required", "error")
      return false
    }

    if (!googlePlaceId) {
      showToast("Please search and select your venue from Google first", "error")
      return false
    }

    if (!ownerPhone.trim()) {
      showToast("Phone number is required", "error")
      return false
    }

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
      return false
    }

    return true
  }

  const saveDraft = async (): Promise<string | null> => {
    if (!validateForm()) {
      return null
    }

    setIsSubmitting(true)

    try {
      const validTables = tables.filter((t) => {
        if (!t.name.trim() || t.seats.length === 0) return false
        
        if (t.bookingMode === "group") {
          return t.tablePricePerHour && t.tablePricePerHour > 0
        } else {
          return t.seats.every((s) => s.pricePerHour > 0)
        }
      })

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
          onboardingStatus: "DRAFT", // Save as draft
          tables: validTables.map((table) => ({
            name: table.name.trim(),
            seatCount: table.seats.length,
            bookingMode: table.bookingMode,
            tablePricePerHour: table.bookingMode === "group" ? table.tablePricePerHour : null,
            imageUrls: table.imageUrls.length > 0 ? table.imageUrls : null,
            directionsText: table.directionsText.trim() || null,
            seats: table.seats.map((seat, index) => ({
              pricePerHour: seat.pricePerHour,
              position: seat.position ?? index + 1,
              label: seat.label?.trim() || null,
              tags: seat.tags.length > 0 ? seat.tags : null,
              imageUrls: seat.imageUrls.length > 0 ? seat.imageUrls : null,
            })),
          })),
          googlePlaceId: googlePlaceId || null,
          googleMapsUrl: googleMapsUrl || null,
          openingHoursJson: openingHoursJson || null,
          googlePhotoRefs:
            selectedCatalogIndices.length > 0
              ? selectedCatalogIndices
                  .map((i) => catalog[i])
                  .filter((item): item is typeof catalog[0] & { source: "google" } => item.source === "google")
                  .map((item) => ({ name: item.name, photoReference: item.photoReference }))
                  .filter((ref) => ref.photoReference != null)
                  .length > 0
                ? selectedCatalogIndices
                    .map((i) => catalog[i])
                    .filter((item): item is typeof catalog[0] & { source: "google" } => item.source === "google")
                    .map((item) => ({ name: item.name, photoReference: item.photoReference }))
                : null
              : null,
          heroImageUrl:
            selectedCatalogIndices.length > 0 && catalog[selectedCatalogIndices[0]]
              ? catalog[selectedCatalogIndices[0]].photoUrl
              : null,
          imageUrls:
            selectedCatalogIndices.length > 0
              ? selectedCatalogIndices.map((i) => catalog[i]?.photoUrl).filter(Boolean) as string[]
              : null,
          ownerFirstName: ownerFirstName.trim() || null,
          ownerLastName: ownerLastName.trim() || null,
          ownerPhone: ownerPhone.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMessage = data.error || "Failed to save venue. Please try again."
        console.error("API Error:", data)
        showToast(errorMessage, "error")
        setIsSubmitting(false)
        return null
      }

      setIsSubmitting(false)
      return data.venue.id
    } catch (error) {
      console.error("Error saving venue:", error)
      showToast("An error occurred. Please try again.", "error")
      setIsSubmitting(false)
      return null
    }
  }

  const validateStep1 = (): boolean => {
    if (!googlePlaceId) {
      showToast("Please search and select your venue from Google first", "error")
      return false
    }
    if (!name.trim()) {
      showToast("Venue name is required", "error")
      return false
    }
    if (!address.trim()) {
      showToast("Address is required", "error")
      return false
    }
    if (!ownerPhone.trim()) {
      showToast("Phone number is required", "error")
      return false
    }
    return true
  }

  const handleNext = async () => {
    if (currentStep === 0) {
      setCurrentStep(1)
      return
    }
    if (currentStep === 1) {
      if (!validateStep1()) return
      setCurrentStep(2)
      return
    }
    if (currentStep === 2) {
      setCurrentStep(3)
      return
    }
    if (currentStep === 3) {
      // Save draft, fetch resources, then show QR Codes step
      const venueId = await saveDraft()
      if (!venueId) return
      setDraftVenueId(venueId)
      try {
        const res = await fetch(`/api/venues/${venueId}/resources`)
        if (!res.ok) throw new Error("Failed to load resources")
        const data = await res.json()
        setVenueResources({ tables: data.tables ?? [], seats: data.seats ?? [] })
        setCurrentStep(4)
      } catch (e) {
        console.error(e)
        showToast("Saved venue but could not load seats/tables. You can set up QR codes from your dashboard.", "error")
        router.push(`/venue/onboard/stripe?venueId=${venueId}`)
      }
      return
    }
    // Step 4 (QR Codes): go to Stripe
    if (currentStep === 4 && draftVenueId) {
      router.push(`/venue/onboard/stripe?venueId=${draftVenueId}`)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep((s) => (s - 1) as 0 | 1 | 2 | 3 | 4)
  }

  const generateQr = async (resourceType: "seat" | "table" | "venue", resourceId?: string) => {
    if (!draftVenueId) return
    if (resourceType !== "venue" && !resourceId) return
    const key = resourceType === "venue" ? "venue" : `${resourceType}:${resourceId}`
    setQrLoadingKey(key)
    try {
      const body: { venueId: string; resourceType: string; resourceId?: string } = {
        venueId: draftVenueId,
        resourceType,
      }
      if (resourceType !== "venue") body.resourceId = resourceId
      const res = await fetch("/api/qr-assets/allocate-and-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || "Failed to generate QR code", "error")
        return
      }
      if (data.token) {
        setQrTokensByKey((prev) => ({ ...prev, [key]: data.token }))
        setQrModalToken(data.token)
      }
    } catch (e) {
      console.error(e)
      showToast("Failed to generate QR code", "error")
    } finally {
      setQrLoadingKey(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await handleNext()
  }

  const steps = [
    { step: 0 as const, label: "Welcome" },
    { step: 1 as const, label: "Venue Info" },
    { step: 2 as const, label: "Photos & Rules" },
    { step: 3 as const, label: "Tables & Seats" },
    { step: 4 as const, label: "QR Codes" },
    { step: 5 as const, label: "Stripe" },
  ]

  return (
    <div className="container mx-auto px-4 py-6">
      {ToastComponent}
      <h1 className="mb-4 text-3xl font-semibold tracking-tight">Onboard your venue</h1>

      {/* Progress bar: 4 steps, clickable to go back */}
      <div className="mb-6">
        <div className="flex items-center gap-1">
          {steps.map(({ step, label }, i) => {
            const isPast = step < currentStep
            const isCurrent = step === currentStep
            const isFuture = step > currentStep
            const isClickable = step < currentStep
            return (
              <div key={step} className="flex flex-1 items-center">
                <button
                  type="button"
                  onClick={() => isClickable && step <= 4 && setCurrentStep(step as 0 | 1 | 2 | 3 | 4)}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 rounded-md px-1 py-2 text-center transition-colors",
                    isClickable && "cursor-pointer hover:bg-muted/60",
                    !isClickable && "cursor-default",
                    (isPast || isCurrent) && "text-primary",
                    isFuture && "text-muted-foreground"
                  )}
                >
                  <span className="text-xs font-medium">{label}</span>
                  <span
                    className={cn(
                      "h-1.5 w-full max-w-12 rounded-full",
                      (isPast || isCurrent) && "bg-primary",
                      isFuture && "bg-muted"
                    )}
                  />
                </button>
                {i < steps.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 w-4 shrink-0 rounded",
                      step < currentStep ? "bg-primary" : "bg-muted"
                    )}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 0: Welcome */}
        {currentStep === 0 && (
          <WelcomeOnboardStep />
        )}
        {/* Step 1: Venue Information */}
        {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Venue Information</CardTitle>
            <CardDescription>For now, all new locations must exist on Google first. Search for your venue to pull in address, hours, and photos.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label htmlFor="place-search" className="mb-2 block text-sm font-medium">
                  Find on Google <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="place-search"
                    ref={autocompleteInputRef}
                    type="text"
                    disabled={!apiKey || isLoadingScript || isLoadingPlaceDetails}
                    placeholder={
                      !apiKey
                        ? "Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable"
                        : isLoadingScript
                          ? "Loading..."
                          : isLoadingPlaceDetails
                            ? "Loading place details..."
                            : "Search for your venue on Google"
                    }
                    className="w-full rounded-md border border-input bg-background px-10 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  />
                </div>
                {!apiKey && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env and enable Maps JavaScript API and Places API in Google Cloud.
                  </p>
                )}
              </div>

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

              <div className="border-t pt-4">
                <p className="mb-3 text-sm font-medium">Owner Info</p>
                <p className="mb-3 text-xs text-muted-foreground">Contact details for the venue owner (you)</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="ownerFirstName" className="mb-2 block text-sm font-medium">
                      First Name
                    </label>
                    <input
                      id="ownerFirstName"
                      type="text"
                      value={ownerFirstName}
                      onChange={(e) => setOwnerFirstName(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Jane"
                    />
                  </div>
                  <div>
                    <label htmlFor="ownerLastName" className="mb-2 block text-sm font-medium">
                      Last Name
                    </label>
                    <input
                      id="ownerLastName"
                      type="text"
                      value={ownerLastName}
                      onChange={(e) => setOwnerLastName(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Doe"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label htmlFor="ownerPhone" className="mb-2 block text-sm font-medium">
                    Phone Number <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="ownerPhone"
                    type="tel"
                    required
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Step 2: Venue Photos, Tags, Rules */}
        {currentStep === 2 && (
        <>
        {/* Venue Photos (Google + owner uploads) — show even when empty so owner can add first photo */}
        {(catalog.length > 0 || isLoadingPlaceDetails || googlePlaceId || true) && (
          <Card>
            <CardHeader>
              <CardTitle>Venue Photos</CardTitle>
              <CardDescription>Select the best interior shots (3–8 photos). You can add your own.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingPlaceDetails ? (
                <p className="text-sm text-muted-foreground">Loading photos...</p>
              ) : catalog.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {googlePlaceId ? "No photos available for this place. Add your own below." : "Add your first photo below."}
                  </p>
                  <input
                    ref={venuePhotoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleVenuePhotoUpload(file)
                      e.target.value = ""
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploadingVenuePhoto}
                    onClick={() => venuePhotoInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {uploadingVenuePhoto ? "Uploading…" : "Add your own photo"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
                    {catalog.map((item, catalogIndex) => {
                      const isSelected = selectedCatalogIndices.includes(catalogIndex)
                      const orderIndex = selectedCatalogIndices.indexOf(catalogIndex)
                      return (
                        <button
                          key={catalogIndex}
                          type="button"
                          onClick={() => toggleCatalogPhotoSelection(catalogIndex)}
                          className={cn(
                            "group relative aspect-square overflow-hidden rounded-lg border-2 transition-all",
                            isSelected
                              ? "border-primary ring-2 ring-primary ring-offset-2"
                              : "border-muted hover:border-primary/50"
                          )}
                        >
                          <img
                            src={item.photoUrl}
                            alt={item.source === "google" ? item.name : "Your photo"}
                            className="h-full w-full object-cover"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                <span className="text-xs font-semibold">{orderIndex + 1}</span>
                              </div>
                            </div>
                          )}
                          <button
                            type="button"
                            aria-label="View full size"
                            className="absolute right-1 top-1 rounded bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation()
                              setGalleryInitialIndex(catalogIndex)
                              setGalleryOpen(true)
                            }}
                          >
                            <Expand className="h-3.5 w-3.5" />
                          </button>
                          {item.source === "upload" && (
                            <button
                              type="button"
                              aria-label="Remove photo"
                              className="absolute left-1 top-1 rounded bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeOwnerUpload(item.photoUrl)
                              }}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  <ImageGalleryModal
                    images={catalog.map((c) => c.photoUrl)}
                    initialIndex={galleryInitialIndex}
                    isOpen={galleryOpen}
                    onClose={() => setGalleryOpen(false)}
                  />
                  <input
                    ref={venuePhotoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleVenuePhotoUpload(file)
                      e.target.value = ""
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploadingVenuePhoto || selectedCatalogIndices.length >= 8}
                    onClick={() => venuePhotoInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {uploadingVenuePhoto ? "Uploading…" : "Add your own photo"}
                  </Button>
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
        </>
        )}

        {/* Step 3: Tables & Seats Editor */}
        {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Tables & Seats</CardTitle>
            <CardDescription>Define your seating layout with per-seat pricing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {tables.map((table, tableIndex) => {
                const isExpanded = tables.length === 1 ? true : expandedTableId === table.id
                return (
                <div key={table.id} className="rounded-lg border p-4">
                  {!isExpanded ? (
                    <button
                      type="button"
                      onClick={() => setExpandedTableId(table.id)}
                      className="flex w-full items-center justify-between rounded-md py-2 text-left hover:bg-muted/50"
                    >
                      <span className="text-sm font-medium">
                        Table {tableIndex + 1}: {table.name || "Unnamed"} · {table.seats.length} seat{table.seats.length !== 1 ? "s" : ""}
                        {table.bookingMode === "group" ? " · Group" : " · Individual"}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ) : (
                  <div className="space-y-4">
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

                      <div>
                        <label className="mb-2 block text-sm font-medium">
                          Directions to your seat
                        </label>
                        <textarea
                          rows={3}
                          value={table.directionsText}
                          onChange={(e) => updateTable(table.id, "directionsText", e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          placeholder="e.g., Enter through the lobby, take the stairs to the mezzanine, table by the window."
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Help guests find their seat at this table
                        </p>
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
                {tables.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedTableId(null)}
                    className="mt-2"
                  >
                    <ChevronDown className="mr-1.5 h-4 w-4" />
                    Collapse
                  </Button>
                )}
                  </div>
                  )}
                </div>
              );
              })}

              <Button type="button" variant="outline" onClick={addTable} className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Add Table
              </Button>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Step 4: QR Codes */}
        {currentStep === 4 && draftVenueId && venueResources && (
          <QRCodeOnboardStep
            venueId={draftVenueId}
            resources={venueResources}
            qrTokensByKey={qrTokensByKey}
            qrLoadingKey={qrLoadingKey}
            onGenerate={generateQr}
            onShowModal={setQrModalToken}
          />
        )}

      </form>

      {/* QR ready modal (onboarding) */}
      <Dialog
        open={qrModalToken !== null}
        onOpenChange={(open) => !open && setQrModalToken(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>QR ready</DialogTitle>
          </DialogHeader>
          {qrModalToken && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <img
                  src={`/api/qr-assets/${qrModalToken}/qr-only.svg`}
                  alt="QR preview"
                  className="h-24 w-24"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`/api/qr-assets/${qrModalToken}/qr-only.svg`}
                    download="nooc-qr-only.svg"
                  >
                    Download QR only (SVG)
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`/api/qr-assets/${qrModalToken}/sticker.svg`}
                    download="nooc-sticker.svg"
                  >
                    Download full sticker (SVG)
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Sticky Back / Next — above bottom nav (bottom-20) */}
      <div className="fixed bottom-20 left-0 right-0 z-10 border-t bg-background p-4 sm:px-6">
        <div className="container mx-auto flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={currentStep > 0 ? handleBack : () => router.push("/venue/dashboard")}
          >
            Back
          </Button>
          <Button
            type="button"
            onClick={handleNext}
            disabled={isSubmitting}
            size="lg"
            className="w-full sm:w-auto sm:min-w-[8rem]"
          >
            {isSubmitting
              ? "Saving..."
              : currentStep === 0
                ? "Continue"
                : currentStep === 3
                  ? "Next"
                  : currentStep === 4
                    ? "Next: Stripe"
                    : "Next"}
          </Button>
        </div>
      </div>
      {/* Add padding to bottom of content so it scrolls above sticky bar + bottom nav */}
      <div className="h-40" />
    </div>
  )
}
