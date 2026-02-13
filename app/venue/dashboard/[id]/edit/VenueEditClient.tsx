"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { Plus, Trash2, Search, Upload, X, Expand } from "lucide-react"
import { cn } from "@/lib/utils"
import { parseGooglePeriodsToVenueHours } from "@/lib/venue-hours"
import { ImageGalleryModal } from "@/components/ui/ImageGalleryModal"
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
  position?: number
  pricePerHour: number
  tags: string[]
  imageUrls: string[]
}

interface Table {
  id: string
  name: string
  bookingMode: "group" | "individual"
  defaultPrice: number
  tablePricePerHour?: number
  imageUrls: string[]
  directionsText: string
  seats: Seat[]
}

interface VenueEditClientProps {
  venue: {
    id: string
    name: string
    address: string | null
    city: string | null
    state: string | null
    zipCode: string | null
    latitude: number | null
    longitude: number | null
    ownerFirstName: string | null
    ownerLastName: string | null
    ownerPhone: string
    tags: string[]
    rulesText: string | null
    heroImageUrl: string | null
    imageUrls: unknown
    placePhotoUrls?: unknown
    googlePlaceId: string | null
    googleMapsUrl: string | null
    openingHoursJson: unknown
    venueHours?: Array<{
      id: string
      dayOfWeek: number
      isClosed: boolean
      openTime: string | null
      closeTime: string | null
    }>
    tables: Array<{
      id: string
      name: string | null
      bookingMode: string
      tablePricePerHour: number | null
      imageUrls: unknown
      directionsText: string | null
      seats: Array<{
        id: string
        label: string | null
        position: number | null
        pricePerHour: number
        tags: unknown
        imageUrls: unknown
      }>
    }>
  }
}

export function VenueEditClient({ venue }: VenueEditClientProps) {
  const router = useRouter()
  const { showToast, ToastComponent } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingScript, setIsLoadingScript] = useState(true)
  const autocompleteInputRef = useRef<HTMLInputElement>(null)

  const autocompleteRef = useRef<any>(null)
  const venuePhotoInputRef = useRef<HTMLInputElement>(null)

  // Parse imageUrls
  const parseImageUrls = (urls: unknown): string[] => {
    if (!urls) return []
    if (Array.isArray(urls)) {
      return urls.filter((u): u is string => typeof u === "string" && u.length > 0)
    }
    if (typeof urls === "string") {
      try {
        const parsed = JSON.parse(urls)
        if (Array.isArray(parsed)) {
          return parsed.filter((u): u is string => typeof u === "string" && u.length > 0)
        }
      } catch {
        if (urls.length > 0) return [urls]
      }
    }
    return []
  }

  // URLs from Google Places API (exact match can vary by params); exclude these from owner uploads to avoid duplicates
  const isGooglePlacesPhotoUrl = (url: string): boolean => {
    if (!url || typeof url !== "string") return false
    return (
      url.includes("places.googleapis.com") ||
      url.includes("maps.googleapis.com") ||
      url.includes("photo_reference=") ||
      url.includes("lh3.googleusercontent.com")
    )
  }

  const parsePlacePhotoUrls = (urls: unknown): string[] => {
    if (!urls) return []
    if (Array.isArray(urls)) {
      return urls.filter((u): u is string => typeof u === "string" && u.length > 0)
    }
    return []
  }

  // Same photo by pathname so query/encoding differences don't create duplicate catalog entries
  const samePhotoUrl = (a: string, b: string): boolean => {
    if (!a || !b || a === b) return a === b
    try {
      return new URL(a).pathname === new URL(b).pathname
    } catch {
      return a === b
    }
  }

  // Parse seat/tags
  const parseTags = (tags: unknown): string[] => {
    if (!tags) return []
    if (Array.isArray(tags)) {
      return tags.filter((t): t is string => typeof t === "string" && t.length > 0)
    }
    return []
  }

  // Initialize form state from venue data
  const [name, setName] = useState(venue.name)
  const [address, setAddress] = useState(venue.address || "")
  const [city, setCity] = useState(venue.city || "")
  const [state, setState] = useState(venue.state || "")
  const [zipCode, setZipCode] = useState(venue.zipCode || "")
  const [latitude, setLatitude] = useState(venue.latitude?.toString() || "")
  const [longitude, setLongitude] = useState(venue.longitude?.toString() || "")
  const [ownerFirstName, setOwnerFirstName] = useState(venue.ownerFirstName || "")
  const [ownerLastName, setOwnerLastName] = useState(venue.ownerLastName || "")
  const [ownerPhone, setOwnerPhone] = useState(venue.ownerPhone || "")
  const [tags, setTags] = useState<string[]>(venue.tags || [])
  const [rulesText, setRulesText] = useState(venue.rulesText || "")
  const [seatCountInputs, setSeatCountInputs] = useState<Record<string, string>>({})
  const [tables, setTables] = useState<Table[]>(() => {
    return venue.tables.map((table, tableIdx) => {
      const bookingMode = (table.bookingMode || "individual") as "group" | "individual"
      const defaultPrice =
        bookingMode === "individual" && table.seats.length > 0
          ? table.seats[0].pricePerHour
          : bookingMode === "group"
            ? table.tablePricePerHour || 0
            : 0

      return {
        id: table.id,
        name: table.name || "",
        bookingMode,
        defaultPrice,
        tablePricePerHour: table.tablePricePerHour || undefined,
        imageUrls: parseImageUrls(table.imageUrls),
        directionsText: table.directionsText || "",
        seats: table.seats.map((seat, seatIdx) => ({
          id: seat.id,
          label: seat.label || undefined,
          position: seat.position ?? seatIdx + 1,
          pricePerHour: seat.pricePerHour,
          tags: parseTags(seat.tags),
          imageUrls: parseImageUrls(seat.imageUrls),
        })),
      }
    })
  })

  const [googlePlaceId, setGooglePlaceId] = useState<string | null>(venue.googlePlaceId)
  const [googleMapsUrl, setGoogleMapsUrl] = useState<string | null>(venue.googleMapsUrl)
  const [openingHoursJson, setOpeningHoursJson] = useState<any>(venue.openingHoursJson)
  
  // Initialize hours state - create 7 days if none exist
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  const initializeHours = () => {
    // Priority 1: Manual edits (venueHours) - these take precedence
    if (venue.venueHours && venue.venueHours.length === 7) {
      return venue.venueHours.map(h => ({
        dayOfWeek: h.dayOfWeek,
        isClosed: h.isClosed,
        openTime: h.openTime || "",
        closeTime: h.closeTime || "",
      }))
    }
    
    // Priority 2: Google hours (openingHoursJson) - parse if available
    const jsonHours = venue.openingHoursJson as { periods?: unknown[] } | null | undefined
    if (jsonHours?.periods && Array.isArray(jsonHours.periods) && jsonHours.periods.length > 0) {
      try {
        const hoursData = parseGooglePeriodsToVenueHours(
          jsonHours.periods as Parameters<typeof parseGooglePeriodsToVenueHours>[0],
          venue.id,
          "google"
        )
        // Ensure we have all 7 days
        const hoursMap = new Map(hoursData.map(h => [h.dayOfWeek, h]))
        return Array.from({ length: 7 }, (_, i) => {
          const existing = hoursMap.get(i)
          if (existing) {
            return {
              dayOfWeek: existing.dayOfWeek,
              isClosed: existing.isClosed,
              openTime: existing.openTime || "",
              closeTime: existing.closeTime || "",
            }
          }
          return {
            dayOfWeek: i,
            isClosed: true,
            openTime: "",
            closeTime: "",
          }
        })
      } catch (error) {
        console.error("Error parsing Google hours:", error)
        // Fall through to default
      }
    }
    
    // Priority 3: Default (all closed)
    return Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      isClosed: true,
      openTime: "",
      closeTime: "",
    }))
  }
  const [hours, setHours] = useState(initializeHours())
  // Single venue hours pathway: manual edit → "manual", "Use Google hours" → "google"
  const [hoursSourceChoice, setHoursSourceChoice] = useState<"manual" | "google">(
    (venue as { hoursSource?: string | null }).hoursSource === "google" ? "google" : "manual"
  )
  const [placePhotoUrls, setPlacePhotoUrls] = useState<string[]>(() =>
    parsePlacePhotoUrls(venue.placePhotoUrls)
  )
  const [ownerUploadedUrls, setOwnerUploadedUrls] = useState<string[]>([])
  const [selectedCatalogIndices, setSelectedCatalogIndices] = useState<number[]>([])
  const [isLoadingPlaceDetails, setIsLoadingPlaceDetails] = useState(false)
  const [uploadingImages, setUploadingImages] = useState<Set<string>>(new Set())
  const [uploadingVenuePhoto, setUploadingVenuePhoto] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0)
  const [showAllPhotoOptions, setShowAllPhotoOptions] = useState(false)
  const lastSyncedVenueDataRef = useRef<string | null>(null)

  // Catalog = place photos (Supabase) + owner uploads; dedupe by same-photo so each image appears once
  const catalog: Array<{ source: "place" | "upload"; photoUrl: string }> = [
    ...placePhotoUrls.map((url) => ({ source: "place" as const, photoUrl: url })),
    ...ownerUploadedUrls
      .filter((url) => !placePhotoUrls.some((p) => samePhotoUrl(p, url)))
      .map((url) => ({ source: "upload" as const, photoUrl: url })),
  ]

  // Selected photos for default view: ordered by selection, deduped by same-photo so no duplicate tiles
  const selectedPhotoUrlsForDisplay = (() => {
    const ordered = selectedCatalogIndices
      .map((i) => catalog[i]?.photoUrl)
      .filter((url): url is string => Boolean(url))
    const seen: string[] = []
    return ordered.filter((url) => {
      if (seen.some((s) => samePhotoUrl(s, url))) return false
      seen.push(url)
      return true
    })
  })()

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  // When venue has no Google place: all images are owner uploads; set catalog and selection
  useEffect(() => {
    if (venue.googlePlaceId) return
    const hero = venue.heroImageUrl ?? null
    const fromImageUrls = parseImageUrls(venue.imageUrls).filter((u) => !isGooglePlacesPhotoUrl(u))
    const urls = [...new Set([...(hero ? [hero] : []), ...fromImageUrls])]
    setOwnerUploadedUrls(urls)
    setSelectedCatalogIndices(urls.map((_, i) => i))
  }, [venue.googlePlaceId, venue.imageUrls, venue.heroImageUrl])

  // When venue has Google place but no placePhotoUrls yet: persist all place photos to Supabase
  useEffect(() => {
    if (!venue.googlePlaceId || placePhotoUrls.length > 0) return

    const persistPlacePhotos = async () => {
      setIsLoadingPlaceDetails(true)
      try {
        const response = await fetch(`/api/venues/${venue.id}/persist-place-photos`, { method: "POST" })
        const data = await response.json()
        if (response.ok && data.placePhotoUrls && Array.isArray(data.placePhotoUrls)) {
          setPlacePhotoUrls(data.placePhotoUrls)
        }
      } catch (error) {
        console.error("Error persisting place photos:", error)
      } finally {
        setIsLoadingPlaceDetails(false)
      }
    }

    persistPlacePhotos()
  }, [venue.googlePlaceId, venue.id, placePhotoUrls.length])

  // Owner uploads and selection: when venue has Google place, owner = hero+imageUrls not same as any place photo; selection = same-photo match in catalog
  // Skip until we have placePhotoUrls (from server or persist API) so we don't show only the selected photos while loading
  useEffect(() => {
    if (!venue.googlePlaceId) return
    if (placePhotoUrls.length === 0) return

    const hero = venue.heroImageUrl ?? null
    const venueImageUrls = parseImageUrls(venue.imageUrls)
    const allVenueUrls = [...(hero ? [hero] : []), ...venueImageUrls.filter((u) => u !== hero)]
    const ownerUploaded = [...new Set(allVenueUrls.filter((u) => u && !placePhotoUrls.some((p) => samePhotoUrl(u, p))))]
    setOwnerUploadedUrls(ownerUploaded)

    const builtCatalog: Array<{ source: "place" | "upload"; photoUrl: string }> = [
      ...placePhotoUrls.map((url) => ({ source: "place" as const, photoUrl: url })),
      ...ownerUploaded.map((url) => ({ source: "upload" as const, photoUrl: url })),
    ]
    const desiredOrder = [...(hero ? [hero] : []), ...venueImageUrls.filter((u) => u !== hero)]
    const selected: number[] = []
    for (const url of desiredOrder) {
      const idx = builtCatalog.findIndex((item) => samePhotoUrl(item.photoUrl, url))
      if (idx >= 0 && !selected.includes(idx)) selected.push(idx)
    }
    if (selected.length === 0 && builtCatalog.length > 0) {
      const defaultCount = Math.min(5, Math.max(3, builtCatalog.length))
      for (let i = 0; i < defaultCount; i++) selected.push(i)
    }
    setSelectedCatalogIndices(selected)
  }, [venue.googlePlaceId, venue.heroImageUrl, venue.imageUrls, placePhotoUrls])

  // Re-sync photo selection when venue.placePhotoUrls, venue.heroImageUrl, or venue.imageUrls change (same-photo match)
  useEffect(() => {
    const venueImageUrls = parseImageUrls(venue.imageUrls)
    const heroImageUrl = venue.heroImageUrl ?? null
    const currentDataKey = JSON.stringify({
      placePhotoUrls,
      imageUrls: venueImageUrls,
      heroImageUrl,
    })
    if (lastSyncedVenueDataRef.current === currentDataKey) return
    lastSyncedVenueDataRef.current = currentDataKey

    const builtCatalog: Array<{ source: "place" | "upload"; photoUrl: string }> = [
      ...placePhotoUrls.map((url) => ({ source: "place" as const, photoUrl: url })),
      ...ownerUploadedUrls.map((url) => ({ source: "upload" as const, photoUrl: url })),
    ]
    const desiredOrder = [
      ...(heroImageUrl ? [heroImageUrl] : []),
      ...venueImageUrls.filter((u) => u !== heroImageUrl),
    ]
    const selected: number[] = []
    for (const url of desiredOrder) {
      const idx = builtCatalog.findIndex((item) => samePhotoUrl(item.photoUrl, url))
      if (idx >= 0 && !selected.includes(idx)) selected.push(idx)
    }
    setSelectedCatalogIndices(selected)
  }, [venue.imageUrls, venue.heroImageUrl, placePhotoUrls, ownerUploadedUrls])

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

      // Don't update name - venue name is locked after creation
      // if (place.name) setName(place.name)
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
              showToast(`Place details loaded! Found ${data.photos.length} photos.`, "success")
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
  }, [isLoadingScript, showToast])

  // Reuse table/seat management functions from onboarding (simplified versions)
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
        directionsText: "",
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
          return {
            ...t,
            [field]: value,
            seats: t.seats.map((seat) => ({
              ...seat,
              pricePerHour: value || 0,
            })),
          }
        }
        return { ...t, [field]: value }
      })
    )
  }

  const updateSeatCount = (tableId: string, count: number) => {
    if (count < 1) return

    setTables(
      tables.map((table) => {
        if (table.id !== tableId) return table

        const currentCount = table.seats.length
        const defaultPrice = table.bookingMode === "group"
          ? (table.tablePricePerHour || table.defaultPrice || 0)
          : (table.defaultPrice || 0)

        if (count > currentCount) {
          const newSeats: Seat[] = Array.from({ length: count - currentCount }, (_, i) => ({
            id: `${tableId}-${currentCount + i + 1}`,
            position: currentCount + i + 1,
            pricePerHour: defaultPrice,
            tags: [],
            imageUrls: [],
          }))
          return {
            ...table,
            seats: [...table.seats, ...newSeats],
          }
        } else if (count < currentCount) {
          return {
            ...table,
            seats: table.seats.slice(0, count).map((seat, idx) => ({
              ...seat,
              position: idx + 1,
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
      if (idx >= 0) return prev.filter((i) => i !== catalogIndex)
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
      formData.append("id", venue.id)
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
    const catalogIndexToRemove = placePhotoUrls.length + idx
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Prevent submission if triggered by autocomplete
    if ((e.nativeEvent as any).submitter?.id === "place-search") {
      return
    }
    
    setIsSubmitting(true)

    // Validation (name is locked, so we don't validate it)
    if (!address.trim()) {
      showToast("Address is required", "error")
      setIsSubmitting(false)
      return
    }

    // Validate tables
    const validTables = tables.filter((t) => {
      const displaySeatCount = seatCountInputs[t.id] ?? String(t.seats.length)
      if (displaySeatCount === "" || parseInt(displaySeatCount, 10) < 1) return false
      if (!t.name.trim() || t.seats.length === 0) return false

      if (t.bookingMode === "group") {
        return t.tablePricePerHour && t.tablePricePerHour > 0
      } else {
        return t.seats.every((s) => s.pricePerHour > 0)
      }
    })

    if (validTables.length === 0) {
      showToast("Each table must have at least 1 seat. Please enter a number of seats for every table.", "error")
      setIsSubmitting(false)
      return
    }

    try {
      const response = await fetch(`/api/venues/${venue.id}`, {
        method: "PATCH",
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
          ownerFirstName: ownerFirstName.trim() || null,
          ownerLastName: ownerLastName.trim() || null,
          ownerPhone: ownerPhone.trim(),
          tags,
          rulesText: rulesText.trim() || null,
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
          hoursSource: hoursSourceChoice,
          venueHours: hours.map(h => ({
            dayOfWeek: h.dayOfWeek,
            isClosed: h.isClosed,
            openTime: h.isClosed ? null : h.openTime || null,
            closeTime: h.isClosed ? null : h.closeTime || null,
          })),
          googlePhotoRefs: null,
          heroImageUrl:
            selectedCatalogIndices.length > 0 && catalog[selectedCatalogIndices[0]]
              ? catalog[selectedCatalogIndices[0]].photoUrl
              : venue.heroImageUrl,
          imageUrls:
            selectedCatalogIndices.length > 0
              ? (selectedCatalogIndices.map((i) => catalog[i]?.photoUrl).filter(Boolean) as string[])
              : parseImageUrls(venue.imageUrls),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMessage = data.error || "Failed to update venue. Please try again."
        console.error("API Error:", data)
        showToast(errorMessage, "error")
        setIsSubmitting(false)
        return
      }

      showToast("Venue updated successfully!", "success")
      setTimeout(() => {
        router.push(`/venue/dashboard/${venue.id}`)
      }, 1000)
    } catch (error) {
      console.error("Error updating venue:", error)
      showToast("An error occurred. Please try again.", "error")
      setIsSubmitting(false)
    }
  }

  // Reuse the form JSX from onboarding (abbreviated - full form would be very long)
  // For now, I'll create a simplified version that includes the key fields
  return (
    <div className="container mx-auto px-4 py-6">
      {ToastComponent}
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">Edit venue</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Venue Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>Venue Information</CardTitle>
            <CardDescription>Update your venue details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="mb-2 block text-sm font-medium">
                  Venue Name <span className="text-destructive">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  readOnly
                  disabled
                  className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
                  placeholder="The Cozy Corner"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Venue name cannot be changed after creation
                </p>
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
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
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
                <p className="mb-3 text-xs text-muted-foreground">Contact details for the venue owner</p>
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

        {/* Venue Photos: default = Selected photos only; expanded = full catalog */}
        {(catalog.length > 0 || isLoadingPlaceDetails || googlePlaceId || true) && (
          <Card>
            <CardHeader>
              <CardTitle>Venue Photos</CardTitle>
              <CardDescription>
                {showAllPhotoOptions
                  ? "Choose or change which photos to use (3–8 recommended)."
                  : "Selected photos for your listing."}
              </CardDescription>
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
              ) : showAllPhotoOptions ? (
                <div className="space-y-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowAllPhotoOptions(false)}
                  >
                    Done
                  </Button>
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
                    {catalog.map((item, catalogIndex) => {
                      const isSelected = selectedCatalogIndices.includes(catalogIndex)
                      const orderIndex = selectedCatalogIndices.indexOf(catalogIndex)
                      return (
                        <div
                          key={catalogIndex}
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleCatalogPhotoSelection(catalogIndex)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              toggleCatalogPhotoSelection(catalogIndex)
                            }
                          }}
                          className={cn(
                            "group relative aspect-square cursor-pointer overflow-hidden rounded-lg border-2 transition-all",
                            isSelected
                              ? "border-primary ring-2 ring-primary ring-offset-2"
                              : "border-muted hover:border-primary/50"
                          )}
                        >
                          <img
                            src={item.photoUrl}
                            alt={item.source === "place" ? "Place photo" : "Your photo"}
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
                        </div>
                      )
                    })}
                  </div>
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
              ) : (
                <div className="space-y-3">
                  {selectedPhotoUrlsForDisplay.length === 0 ? (
                    <>
                      <p className="text-sm text-muted-foreground">No photos selected.</p>
                      <Button
                        type="button"
                        onClick={() => setShowAllPhotoOptions(true)}
                      >
                        See All Photo Options
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
                        {selectedPhotoUrlsForDisplay.map((url, idx) => (
                          <div
                            key={idx}
                            className="group relative aspect-square overflow-hidden rounded-lg border-2 border-primary ring-2 ring-primary ring-offset-2"
                          >
                            <img
                              src={url}
                              alt="Selected"
                              className="h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                <span className="text-xs font-semibold">{idx + 1}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              aria-label="View full size"
                              className="absolute right-1 top-1 rounded bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                              onClick={() => {
                                setGalleryInitialIndex(idx)
                                setGalleryOpen(true)
                              }}
                            >
                              <Expand className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowAllPhotoOptions(true)}
                      >
                        See All Photo Options
                      </Button>
                    </>
                  )}
                </div>
              )}
              {!isLoadingPlaceDetails && catalog.length > 0 && (
                <ImageGalleryModal
                  images={showAllPhotoOptions ? catalog.map((c) => c.photoUrl) : selectedPhotoUrlsForDisplay}
                  initialIndex={galleryInitialIndex}
                  isOpen={galleryOpen}
                  onClose={() => setGalleryOpen(false)}
                />
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

        {/* Hours */}
        <Card>
          <CardHeader>
            <CardTitle>Opening Hours</CardTitle>
            <CardDescription>Set your venue&apos;s weekly schedule. Manual edits set source to manual; use Google hours to pull from your place listing.</CardDescription>
            {openingHoursJson?.periods && Array.isArray(openingHoursJson.periods) && openingHoursJson.periods.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  try {
                    const hoursData = parseGooglePeriodsToVenueHours(
                      openingHoursJson.periods as Parameters<typeof parseGooglePeriodsToVenueHours>[0],
                      venue.id,
                      "google"
                    )
                    const hoursMap = new Map(hoursData.map((h) => [h.dayOfWeek, h]))
                    setHours(
                      Array.from({ length: 7 }, (_, i) => {
                        const existing = hoursMap.get(i)
                        if (existing) {
                          return {
                            dayOfWeek: existing.dayOfWeek,
                            isClosed: existing.isClosed,
                            openTime: existing.openTime || "",
                            closeTime: existing.closeTime || "",
                          }
                        }
                        return { dayOfWeek: i, isClosed: true, openTime: "", closeTime: "" }
                      })
                    )
                    setHoursSourceChoice("google")
                    showToast("Hours updated from Google. Save to apply.", "success")
                  } catch (e) {
                    console.error(e)
                    showToast("Could not parse Google hours.", "error")
                  }
                }}
              >
                Use Google hours
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {hours.map((day, index) => (
                <div key={day.dayOfWeek} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="w-24 text-sm font-medium">{DAY_NAMES[day.dayOfWeek]}</div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!day.isClosed}
                      onChange={(e) => {
                        const newHours = [...hours]
                        newHours[index].isClosed = !e.target.checked
                        if (newHours[index].isClosed) {
                          newHours[index].openTime = ""
                          newHours[index].closeTime = ""
                        }
                        setHours(newHours)
                        setHoursSourceChoice("manual")
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm">Open</span>
                  </label>
                  {!day.isClosed && (
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        type="time"
                        value={day.openTime}
                        onChange={(e) => {
                          const newHours = [...hours]
                          newHours[index].openTime = e.target.value
                          setHours(newHours)
                          setHoursSourceChoice("manual")
                        }}
                        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      />
                      <span className="text-sm text-muted-foreground">to</span>
                      <input
                        type="time"
                        value={day.closeTime}
                        onChange={(e) => {
                          const newHours = [...hours]
                          newHours[index].closeTime = e.target.value
                          setHours(newHours)
                          setHoursSourceChoice("manual")
                        }}
                        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      />
                    </div>
                  )}
                  {day.isClosed && (
                    <div className="flex-1 text-sm text-muted-foreground">Closed</div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tables & Seats Editor - Simplified for now */}
        <Card>
          <CardHeader>
            <CardTitle>Tables & Seats</CardTitle>
            <CardDescription>Manage your seating layout</CardDescription>
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
                      </div>

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
                        </div>
                      )}

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
                        </div>
                      )}

                      <div>
                        <label className="mb-2 block text-sm font-medium">
                          Number of Seats <span className="text-destructive">*</span>
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={seatCountInputs[table.id] !== undefined ? seatCountInputs[table.id] : String(table.seats.length)}
                          onChange={(e) => {
                            const value = e.target.value
                            setSeatCountInputs((prev) => ({ ...prev, [table.id]: value }))
                            const numValue = parseInt(value, 10)
                            if (!isNaN(numValue) && numValue >= 1) {
                              updateSeatCount(table.id, numValue)
                              setSeatCountInputs((prev) => {
                                const next = { ...prev }
                                delete next[table.id]
                                return next
                              })
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

                  {table.bookingMode === "individual" && (
                    <div className="space-y-3 border-t pt-4">
                      <h4 className="text-sm font-medium">Seats</h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {table.seats.map((seat, seatIndex) => (
                          <div key={seat.id} className="space-y-2 rounded-md border p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                Seat {seat.position ?? seatIndex + 1}
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
                                className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                              />
                            </div>

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
          <Button type="submit" loading={isSubmitting} size="lg">
            {isSubmitting ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  )
}
