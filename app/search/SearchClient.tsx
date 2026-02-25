"use client"

import React, { useState, useCallback, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { MapPin, Search, Users, Navigation, Map, List } from "lucide-react"
import Image from "next/image"
import { roundUpToNext15Minutes, getLocalDateString } from "@/lib/availability-utils"

interface SearchResult {
  id: string
  name: string
  address: string
  neighborhood: string
  city: string
  state: string
  latitude: number | null
  longitude: number | null
  minPrice: number
  capacity: number
  availabilityLabel: string | null
  openStatus: { status: string; todayHoursText: string } | null
  imageUrls: string[]
  distanceKm: number | null
}

export function SearchClient() {
  const router = useRouter()

  // Initialize date/time to now (rounded to next 15 min)
  const now = useMemo(() => new Date(), [])
  const rounded = useMemo(() => roundUpToNext15Minutes(now), [now])
  const todayStr = useMemo(() => getLocalDateString(now), [now])

  const [date, setDate] = useState(todayStr)
  const [startTime, setStartTime] = useState(
    `${String(rounded.getHours()).padStart(2, "0")}:${String(rounded.getMinutes()).padStart(2, "0")}`
  )
  const [durationHours, setDurationHours] = useState(2)
  const [seats, setSeats] = useState(2)

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle")
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [viewMode, setViewMode] = useState<"list" | "map">("list")

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus("denied")
      return
    }
    setLocationStatus("requesting")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocationStatus("granted")
      },
      () => {
        setLocationStatus("denied")
      },
      { enableHighAccuracy: false, timeout: 10000 }
    )
  }, [])

  useEffect(() => {
    requestLocation()
  }, [requestLocation])

  const handleSearch = useCallback(async () => {
    setIsSearching(true)
    setHasSearched(true)
    try {
      const params = new URLSearchParams()
      params.set("seats", String(seats))
      if (userLocation) {
        params.set("lat", String(userLocation.lat))
        params.set("lng", String(userLocation.lng))
      }
      // Use date + time to determine if "available now" or "open today"
      const isToday = date === todayStr
      const nowRounded = roundUpToNext15Minutes(new Date())
      const nowTimeStr = `${String(nowRounded.getHours()).padStart(2, "0")}:${String(nowRounded.getMinutes()).padStart(2, "0")}`
      if (isToday && startTime <= nowTimeStr) {
        params.set("availableNow", "true")
      } else {
        params.set("openToday", "true")
      }

      const res = await fetch(`/api/search?${params.toString()}`)
      const data = await res.json()
      setResults(data.venues || [])
    } catch {
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [seats, userLocation, date, startTime, todayStr])

  const formatDistance = (km: number | null) => {
    if (km == null) return null
    if (km < 1) return `${Math.round(km * 1000)}m away`
    return `${km.toFixed(1)}km away`
  }

  // Build deep-link URL to venue booking page with pre-filled params
  const getVenueUrl = useCallback(
    (venueId: string) => {
      const [h, m] = startTime.split(":").map(Number)
      const startTimeValue = h * 100 + m
      const bookingPayload = encodeURIComponent(
        JSON.stringify({
          date,
          startTime: startTimeValue,
          duration: durationHours,
        })
      )
      return `/venue/${venueId}?seats=${seats}&booking=${bookingPayload}`
    },
    [date, startTime, durationHours, seats]
  )

  const inputClass =
    "rounded-md border border-muted/60 bg-white px-3 py-2 text-sm shadow-sm outline-none ring-0 ring-offset-0 focus:border-primary focus:ring-1 focus:ring-primary"

  // Map view — navigate to explore map
  useEffect(() => {
    if (viewMode === "map") {
      router.replace("/?view=map")
    }
  }, [viewMode, router])

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="px-4 pt-10 pb-6 sm:pt-14 sm:pb-8">
        <div className="mx-auto max-w-lg text-center">
          <div className="mb-3 flex items-center justify-center">
            <Image
              src="/nooc-logo.png"
              alt="Nooc"
              width={44}
              height={44}
              className="rounded-xl"
            />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Find a Nooc
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Reserve a calm workspace by the hour
          </p>
        </div>
      </div>

      {/* Search Form */}
      <div className="px-4 pb-4">
        <Card className="mx-auto max-w-lg">
          <CardContent className="p-5 space-y-4">
            {/* Date & Time row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Date
                </Label>
                <input
                  type="date"
                  className={inputClass}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={todayStr}
                />
              </div>
              <div className="flex flex-col space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Start time
                </Label>
                <input
                  type="time"
                  className={inputClass}
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
            </div>

            {/* Duration & Seats row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Duration
                </Label>
                <select
                  className={inputClass}
                  value={durationHours}
                  onChange={(e) => setDurationHours(Number(e.target.value))}
                >
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((h) => (
                    <option key={h} value={h}>
                      {h} hour{h > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Seats
                </Label>
                <select
                  className={inputClass}
                  value={seats}
                  onChange={(e) => setSeats(Number(e.target.value))}
                >
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((s) => (
                    <option key={s} value={s}>
                      {s} seat{s > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Location
              </Label>
              {locationStatus === "granted" && userLocation ? (
                <div className="flex items-center gap-2 rounded-md bg-primary/5 px-3 py-2 text-sm text-primary">
                  <Navigation className="h-4 w-4 shrink-0" />
                  <span className="font-medium">Using your location</span>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={requestLocation}
                  loading={locationStatus === "requesting"}
                >
                  <Navigation className="h-4 w-4" />
                  {locationStatus === "denied"
                    ? "Location unavailable — showing all venues"
                    : "Use my location"}
                </Button>
              )}
            </div>

            {/* Search Button */}
            <Button
              className="w-full gap-2"
              size="lg"
              onClick={handleSearch}
              loading={isSearching}
            >
              <Search className="h-5 w-5" />
              Search
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Map / List toggle bar */}
      <div className="px-4 pb-4">
        <div className="mx-auto max-w-lg flex items-center justify-center">
          <div className="inline-flex rounded-xl border bg-white shadow-sm overflow-hidden">
            <button
              type="button"
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-colors ${
                viewMode === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
              onClick={() => setViewMode("list")}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
            <button
              type="button"
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-colors ${
                viewMode === "map"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
              onClick={() => setViewMode("map")}
            >
              <Map className="h-3.5 w-3.5" />
              Map
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {hasSearched && (
        <div className="px-4 pb-24">
          <div className="mx-auto max-w-lg">
            {isSearching ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <LoadingSpinner size="md" />
                <p className="text-sm text-muted-foreground">Finding workspaces...</p>
              </div>
            ) : results && results.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">
                  {results.length} workspace{results.length !== 1 ? "s" : ""} found
                </p>
                {results.map((venue) => (
                  <button
                    key={venue.id}
                    type="button"
                    className="w-full text-left outline-none"
                    onClick={() => router.push(getVenueUrl(venue.id))}
                  >
                    <Card className="overflow-hidden transition-all hover:shadow-md active:scale-[0.99]">
                      <div className="flex">
                        <div className="relative h-28 w-28 shrink-0 bg-muted sm:h-32 sm:w-32">
                          {venue.imageUrls.length > 0 ? (
                            <Image
                              src={venue.imageUrls[0]}
                              alt={venue.name}
                              fill
                              className="object-cover"
                              sizes="128px"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <MapPin className="h-8 w-8 text-muted-foreground/30" />
                            </div>
                          )}
                        </div>
                        <CardContent className="flex flex-1 flex-col justify-center p-3 sm:p-4">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-foreground line-clamp-1">{venue.name}</h3>
                            <p className="shrink-0 text-sm font-bold text-primary">
                              ${venue.minPrice.toFixed(0)}<span className="text-[10px] text-muted-foreground font-semibold">/hr</span>
                            </p>
                          </div>
                          {(venue.neighborhood || venue.address) && (
                            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                              {venue.neighborhood || venue.address}
                              {venue.city ? `, ${venue.city}` : ""}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {venue.availabilityLabel && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                                {venue.availabilityLabel}
                              </span>
                            )}
                            {venue.distanceKm != null && (
                              <span className="text-[10px] font-medium text-muted-foreground">
                                {formatDistance(venue.distanceKm)}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {venue.capacity} seat{venue.capacity !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </CardContent>
                      </div>
                    </Card>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Search className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">No workspaces found</h3>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Try adjusting your search — fewer seats or a different time might show more options.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
