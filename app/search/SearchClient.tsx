"use client"

import React, { useState, useCallback, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { MapPin, Search, Navigation, Map, X } from "lucide-react"
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
  availableSeats: number
  imageUrls: string[]
  distanceKm: number | null
}

export function SearchClient() {
  const router = useRouter()

  const now = useMemo(() => new Date(), [])
  const rounded = useMemo(() => roundUpToNext15Minutes(now), [now])
  const todayStr = useMemo(() => getLocalDateString(now), [now])

  const [date, setDate] = useState(todayStr)
  const [startTime, setStartTime] = useState(
    `${String(rounded.getHours()).padStart(2, "0")}:${String(rounded.getMinutes()).padStart(2, "0")}`
  )
  const [durationHours, setDurationHours] = useState(2)
  const [seats, setSeats] = useState(2)

  // Location: geo OR text
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle")
  const [locationText, setLocationText] = useState("")
  const [locationMode, setLocationMode] = useState<"auto" | "text">("auto")

  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

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
        setLocationMode("auto")
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
      // Compute startAt/endAt from date + time + duration
      const [h, m] = startTime.split(":").map(Number)
      const startAt = new Date(`${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`)
      const endAt = new Date(startAt.getTime() + durationHours * 60 * 60 * 1000)

      const params = new URLSearchParams()
      params.set("seats", String(seats))
      params.set("startAt", startAt.toISOString())
      params.set("endAt", endAt.toISOString())

      if (locationMode === "auto" && userLocation) {
        params.set("lat", String(userLocation.lat))
        params.set("lng", String(userLocation.lng))
      }
      if (locationMode === "text" && locationText.trim()) {
        params.set("location", locationText.trim())
      }

      const res = await fetch(`/api/search?${params.toString()}`)
      const data = await res.json()
      setResults(data.venues || [])
    } catch {
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [seats, userLocation, date, startTime, durationHours, locationMode, locationText])

  const formatDistance = (km: number | null) => {
    if (km == null) return null
    const miles = km * 0.621371
    if (miles < 0.1) return "0.1 mi away"
    return `${miles.toFixed(1)} mi away`
  }

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
      return `/venue/${venueId}?seats=${seats}&booking=${bookingPayload}&returnTo=${encodeURIComponent("/search")}`
    },
    [date, startTime, durationHours, seats]
  )

  const inputClass =
    "rounded-md border border-muted/60 bg-white px-3 py-2 text-sm shadow-sm outline-none ring-0 ring-offset-0 focus:border-primary focus:ring-1 focus:ring-primary"

  return (
    <div className="min-h-screen bg-background">
      {/* Map icon top-left: same size and position as magnifying glass on explore map */}
      <div className="fixed left-4 top-[max(1rem,env(safe-area-inset-top))] z-10">
        <Link
          href="/?view=map&from=search"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-none bg-white font-bold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] premium-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          aria-label="View on map"
        >
          <Map size={20} strokeWidth={2.5} className="text-primary/70" />
        </Link>
      </div>

      {/* Hero */}
      <div className="px-4 pt-10 pb-6 sm:pt-14 sm:pb-8">
        <div className="mx-auto max-w-lg text-center">
          <div className="mb-3 flex items-center justify-center">
            <Image src="/nooc-logo.png" alt="Nooc" width={44} height={44} className="rounded-xl" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Find a Nooc
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Reserve a workspace by the hour
          </p>
        </div>
      </div>

      {/* Search Form */}
      <div className="px-4 pb-4">
        <Card className="mx-auto max-w-lg">
          <CardContent className="p-5 space-y-4">
            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Date</Label>
                <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} min={todayStr} />
              </div>
              <div className="flex flex-col space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Start time</Label>
                <input type="time" className={inputClass} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
            </div>

            {/* Duration & Seats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Duration</Label>
                <select className={inputClass} value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))}>
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((h) => (
                    <option key={h} value={h}>{h} hour{h > 1 ? "s" : ""}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Seats</Label>
                <select className={inputClass} value={seats} onChange={(e) => setSeats(Number(e.target.value))}>
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((s) => (
                    <option key={s} value={s}>{s} seat{s > 1 ? "s" : ""}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Location</Label>

              {locationMode === "auto" && locationStatus === "granted" && userLocation ? (
                <div className="flex items-center justify-between gap-2 rounded-md bg-primary/5 px-3 py-2 text-sm text-primary">
                  <div className="flex items-center gap-2">
                    <Navigation className="h-4 w-4 shrink-0" />
                    <span className="font-medium">Using your location</span>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    onClick={() => { setLocationMode("text"); setUserLocation(null) }}
                  >
                    Search a location instead
                  </button>
                </div>
              ) : locationMode === "text" ? (
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      placeholder="Neighborhood, city, or address..."
                      value={locationText}
                      onChange={(e) => setLocationText(e.target.value)}
                      className="pr-8"
                    />
                    {locationText && (
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setLocationText("")}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    onClick={() => { setLocationMode("auto"); requestLocation() }}
                  >
                    <Navigation className="h-3 w-3" />
                    Use my location instead
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 justify-start gap-2"
                    onClick={requestLocation}
                    loading={locationStatus === "requesting"}
                  >
                    <Navigation className="h-4 w-4" />
                    Use my location
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 justify-start gap-2"
                    onClick={() => setLocationMode("text")}
                  >
                    <MapPin className="h-4 w-4" />
                    Search a location
                  </Button>
                </div>
              )}
            </div>

            {/* Search Button */}
            <Button className="w-full gap-2" size="lg" onClick={handleSearch} loading={isSearching}>
              <Search className="h-5 w-5" />
              Search
            </Button>
          </CardContent>
        </Card>
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
                  {results.length} workspace{results.length !== 1 ? "s" : ""} available
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
                            <Image src={venue.imageUrls[0]} alt={venue.name} fill className="object-cover" sizes="128px" />
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
                          {venue.distanceKm != null && (
                            <p className="mt-2 text-[10px] font-medium text-muted-foreground">
                              {formatDistance(venue.distanceKm)}
                            </p>
                          )}
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
                <h3 className="text-lg font-semibold text-foreground">No availability found</h3>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  No venues have {seats}+ seats free at this time. Try a different date, time, or fewer seats.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
