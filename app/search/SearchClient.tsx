"use client"

import React, { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { MapPin, Search, Clock, Users, Navigation, ArrowRight } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

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
  const [seats, setSeats] = useState(2)
  const [timing, setTiming] = useState<"now" | "today">("now")
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle")
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
      },
      () => {
        setLocationStatus("denied")
      },
      { enableHighAccuracy: false, timeout: 10000 }
    )
  }, [])

  // Auto-request location on mount so results sort by distance
  useEffect(() => {
    requestLocation()
  }, [requestLocation])

  const handleSearch = useCallback(async () => {
    setIsSearching(true)
    setHasSearched(true)
    try {
      const params = new URLSearchParams()
      params.set("seats", String(seats))
      if (timing === "now") params.set("availableNow", "true")
      if (timing === "today") params.set("openToday", "true")
      if (userLocation) {
        params.set("lat", String(userLocation.lat))
        params.set("lng", String(userLocation.lng))
      }

      const res = await fetch(`/api/search?${params.toString()}`)
      const data = await res.json()
      setResults(data.venues || [])
    } catch {
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [seats, timing, userLocation])

  const formatDistance = (km: number | null) => {
    if (km == null) return null
    if (km < 1) return `${Math.round(km * 1000)}m away`
    return `${km.toFixed(1)}km away`
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="px-4 pt-12 pb-8 sm:pt-16 sm:pb-10">
        <div className="mx-auto max-w-lg text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Find a workspace
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Reserve a calm workspace by the hour
          </p>
        </div>
      </div>

      {/* Search Form */}
      <div className="px-4 pb-6">
        <Card className="mx-auto max-w-lg">
          <CardContent className="p-5 space-y-5">
            {/* When? */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                When?
              </Label>
              <div className="flex gap-2">
                <Button
                  variant={timing === "now" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTiming("now")}
                  className="flex-1"
                >
                  Right now
                </Button>
                <Button
                  variant={timing === "today" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTiming("today")}
                  className="flex-1"
                >
                  Today
                </Button>
              </div>
            </div>

            {/* How many seats? */}
            <div className="space-y-2">
              <Label htmlFor="seat-count" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                How many seats?
              </Label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={() => setSeats((s) => Math.max(1, s - 1))}
                  disabled={seats <= 1}
                >
                  &minus;
                </Button>
                <Input
                  id="seat-count"
                  type="number"
                  min={1}
                  max={20}
                  value={seats}
                  onChange={(e) => setSeats(Math.max(1, parseInt(e.target.value) || 1))}
                  className="text-center text-lg font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={() => setSeats((s) => Math.min(20, s + 1))}
                  disabled={seats >= 20}
                >
                  +
                </Button>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                Location
              </Label>
              {locationStatus === "granted" && userLocation ? (
                <div className="flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2 text-sm text-primary">
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
                    onClick={() => router.push(`/venue/${venue.id}`)}
                  >
                    <Card className="overflow-hidden transition-all hover:shadow-md active:scale-[0.99]">
                      <div className="flex">
                        {/* Venue Image */}
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

                        {/* Info */}
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

                {/* View on Map CTA */}
                <div className="pt-3 text-center">
                  <Button variant="outline" size="sm" asChild className="gap-1.5">
                    <Link href="/?view=map">
                      <MapPin className="h-4 w-4" />
                      View on map
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              /* Empty state */
              <div className="flex flex-col items-center py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Search className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">No workspaces found</h3>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Try adjusting your search — fewer seats or a different time might show more options.
                </p>
                <Button variant="outline" size="sm" asChild className="mt-4 gap-1.5">
                  <Link href="/">
                    <ArrowRight className="h-4 w-4" />
                    Browse all venues
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pre-search: subtle CTA to Explore */}
      {!hasSearched && (
        <div className="px-4 pb-24 text-center">
          <p className="text-xs text-muted-foreground">
            or{" "}
            <Link href="/?view=map" className="font-medium text-primary underline underline-offset-2">
              browse all venues on the map
            </Link>
          </p>
        </div>
      )}
    </div>
  )
}
