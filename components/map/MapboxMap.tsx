"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { Button } from "@/components/ui/button"
import { Navigation } from "lucide-react"
import { useDebounce } from "@/lib/hooks/use-debounce"

interface Venue {
  id: string
  name: string
  address: string
  latitude: number | null
  longitude: number | null
  minPrice: number
  maxPrice: number
  availabilityLabel?: string
}

interface MapboxMapProps {
  venues: Venue[]
  onSelectVenue?: (id: string) => void
  onMapClick?: () => void
  userLocation?: { lat: number; lng: number } | null
  onSearchArea?: (bounds: { north: number; south: number; east: number; west: number }) => void
  isSearching?: boolean
  centerOnVenueId?: string | null
  centerOnCoordinates?: { lat: number; lng: number } | null
  shouldFitBounds?: boolean
  onBoundsFitted?: () => void
  onRequestLocation?: () => void
  locationState?: "idle" | "requesting" | "granted" | "denied" | "unavailable"
  skipFitBounds?: boolean // When true, don't fit bounds even if shouldFitBounds is true
  isSearchingArea?: boolean // When true, user is searching by area (not text)
  onBoundsChange?: (bounds: { north: number; south: number; east: number; west: number }) => void
  onInitialBounds?: (bounds: { north: number; south: number; east: number; west: number }) => void
  didAreaSearch?: boolean // True when area search just completed (synchronous ref, no batching delay)
  /** When true (e.g. parent already has venues), skip loading overlay so remount does not show "Loading map" again */
  initialLoadingComplete?: boolean
  /** When true, show a subtle loading indicator (pins are being fetched but map is ready) */
  isFetchingPins?: boolean
  /** When true, show initial loading overlay (first load, no pins yet) */
  isInitialLoading?: boolean
}

// Default map view (from Explore map moveend: center + zoom)
const NYC_CENTER = { lat: 40.725, lng: -73.9727 }
const DEFAULT_ZOOM = 10.85

export function MapboxMap({
  venues,
  onSelectVenue,
  onMapClick,
  userLocation,
  onSearchArea,
  isSearching = false,
  centerOnVenueId,
  centerOnCoordinates,
  shouldFitBounds,
  onBoundsFitted,
  onRequestLocation,
  locationState,
  skipFitBounds = false,
  isSearchingArea = false,
  onBoundsChange,
  onInitialBounds,
  didAreaSearch = false,
  initialLoadingComplete = false,
  isFetchingPins = false,
  isInitialLoading = false,
}: MapboxMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const userLocationMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const currentBoundsRef = useRef<{ north: number; south: number; east: number; west: number } | null>(null)
  const hasFitBoundsRef = useRef<boolean>(false) // Track if we've done initial fitBounds
  const lastVenuesCountRef = useRef<number>(0) // Track venue count to detect changes
  const hasAutoCenteredRef = useRef<boolean>(false) // Track if we've auto-centered on user location
  const hasUserInteractedWithMapRef = useRef<boolean>(false) // Track if user has manually moved/zoomed the map
  const hasMapLoadedOnceRef = useRef<boolean>(false) // Track if map has loaded at least once
  const onSelectVenueRef = useRef<((id: string) => void) | undefined>(onSelectVenue) // Keep callback current
  const onMapClickRef = useRef<(() => void) | undefined>(onMapClick)
  const pinImageLoadedRef = useRef<boolean>(false) // Track if pin image has been loaded
  const skipFitBoundsRef = useRef<boolean>(false) // Track skipFitBounds in a ref for use in closures
  const isSearchingAreaRef = useRef<boolean>(false) // Track isSearchingArea in a ref for use in closures
  const onBoundsChangeRef = useRef(onBoundsChange)
  const onInitialBoundsRef = useRef(onInitialBounds)
  const hasReportedInitialBoundsRef = useRef(false)
  const pendingAreaSearchRepaintRef = useRef(false) // So interval/handleLoad can repaint even after didAreaSearch prop clears
  const [isLoading, setIsLoading] = useState(!initialLoadingComplete)
  const [mapError, setMapError] = useState<string | null>(null)
  const [showSearchButton, setShowSearchButton] = useState(false)

  const debouncedShowSearchButton = useDebounce(() => {
    setShowSearchButton(true)
  }, 500)

  // Keep callback refs up-to-date
  useEffect(() => {
    onSelectVenueRef.current = onSelectVenue
  }, [onSelectVenue])
  useEffect(() => {
    onMapClickRef.current = onMapClick
  }, [onMapClick])
  useEffect(() => {
    skipFitBoundsRef.current = skipFitBounds
  }, [skipFitBounds])
  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange
  }, [onBoundsChange])
  useEffect(() => {
    onInitialBoundsRef.current = onInitialBounds
  }, [onInitialBounds])
  useEffect(() => {
    // CRITICAL: Set hasUserInteracted FIRST, synchronously, before updating isSearchingAreaRef
    // This ensures the flag is set immediately and available for any code that checks it
    // This must happen before isSearchingAreaRef is updated to prevent race conditions
    if (isSearchingArea) {
      // Set flag immediately and synchronously - no async operations
      hasUserInteractedWithMapRef.current = true
    }
    // Update isSearchingAreaRef AFTER hasUserInteracted is set
    // This ensures any code checking hasUserInteracted will see the correct value
    isSearchingAreaRef.current = isSearchingArea
  }, [isSearchingArea])

  // Hide "Search this area" button when search completes (so it only reappears when user moves map again)
  useEffect(() => {
    if (!isSearching) setShowSearchButton(false)
  }, [isSearching])

  // Convert venues array to GeoJSON FeatureCollection
  const venuesToGeoJSON = (venues: Venue[]) => {
    return {
      type: "FeatureCollection" as const,
      features: venues
        .filter((v) => v.latitude !== null && v.longitude !== null)
        .map((venue) => ({
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [venue.longitude!, venue.latitude!] as [number, number],
          },
          properties: {
            id: venue.id,
            name: venue.name,
            address: venue.address,
            minPrice: venue.minPrice,
            availabilityLabel: venue.availabilityLabel || "",
          },
        })),
    }
  }

  // Create pin icon image (canvas-based, returns data URL)
  const createPinImage = (): string => {
    const size = 24
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      throw new Error("Could not get canvas context")
    }

    // Draw pin shape (rotated square/teardrop)
    ctx.save()
    ctx.translate(size / 2, size / 2)
    ctx.rotate((-45 * Math.PI) / 180) // Rotate -45 degrees

    // Outer pin shape
    ctx.fillStyle = "#0F5132"
    ctx.strokeStyle = "#ffffff"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, -size / 2)
    ctx.lineTo(size / 2, 0)
    ctx.lineTo(0, size / 2)
    ctx.lineTo(-size / 2, 0)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Inner white dot
    ctx.restore()
    ctx.fillStyle = "#ffffff"
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, 5, 0, Math.PI * 2)
    ctx.fill()

    return canvas.toDataURL()
  }

  // Cluster circle images for availability-based coloring (green, red, half-green-half-red)
  const CLUSTER_IMAGE_SIZE = 64
  const CLUSTER_GREEN = "#0F5132"
  const CLUSTER_RED = "#991b1b"

  const createClusterCircleImage = (fillColor: string): ImageData => {
    const size = CLUSTER_IMAGE_SIZE
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Could not get canvas context")
    const center = size / 2
    const radius = center - 4 // leave room for 2px stroke
    ctx.fillStyle = fillColor
    ctx.strokeStyle = "#ffffff"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(center, center, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    return ctx.getImageData(0, 0, size, size)
  }

  const createClusterCircleImageHalfHalf = (): ImageData => {
    const size = CLUSTER_IMAGE_SIZE
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Could not get canvas context")
    const center = size / 2
    const radius = center - 4
    // Left semicircle (green)
    ctx.fillStyle = CLUSTER_GREEN
    ctx.beginPath()
    ctx.moveTo(center, center)
    ctx.arc(center, center, radius, Math.PI * 0.5, Math.PI * 1.5)
    ctx.closePath()
    ctx.fill()
    // Right semicircle (red)
    ctx.fillStyle = CLUSTER_RED
    ctx.beginPath()
    ctx.moveTo(center, center)
    ctx.arc(center, center, radius, Math.PI * 1.5, Math.PI * 0.5)
    ctx.closePath()
    ctx.fill()
    // White stroke around full circle
    ctx.strokeStyle = "#ffffff"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(center, center, radius, 0, Math.PI * 2)
    ctx.stroke()
    return ctx.getImageData(0, 0, size, size)
  }

  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN

  // Initialize venues source and layers
  const initializeVenuesSource = (map: mapboxgl.Map) => {

    // Remove existing event listeners if they exist (layer-specific off; Mapbox types expect listener)
    ;(map as any).off("click", "clusters")
    ;(map as any).off("click", "unclustered-point")
    ;(map as any).off("mouseenter", "clusters")
    ;(map as any).off("mouseleave", "clusters")
    ;(map as any).off("mouseenter", "unclustered-point")
    ;(map as any).off("mouseleave", "unclustered-point")

    // Remove existing source and layers if they exist
    if (map.getSource("venues")) {
      if (map.getLayer("clusters")) map.removeLayer("clusters")
      if (map.getLayer("cluster-count")) map.removeLayer("cluster-count")
      if (map.getLayer("unclustered-point")) map.removeLayer("unclustered-point")
      if (map.getLayer("price-label")) map.removeLayer("price-label")
      map.removeSource("venues")
    }

    // Register cluster circle images once (green, red, half-green-half-red)
    if (!map.hasImage("cluster-green")) {
      map.addImage("cluster-green", createClusterCircleImage(CLUSTER_GREEN))
      map.addImage("cluster-red", createClusterCircleImage(CLUSTER_RED))
      map.addImage("cluster-mixed", createClusterCircleImageHalfHalf())
    }

    // Add GeoJSON source with clustering
    const venuesGeoJSON = venuesToGeoJSON(venues)
    map.addSource("venues", {
      type: "geojson",
      data: venuesGeoJSON,
      cluster: true,
      clusterRadius: 50,
      clusterMaxZoom: 14,
      clusterProperties: {
        availableCount: [
          "+",
          ["case", ["==", ["get", "availabilityLabel"], "Available now"], 1, 0],
        ],
      },
    })


    // Add cluster circle layer (symbol: green / red / half-green-half-red by availability)
    map.addLayer({
      id: "clusters",
      type: "symbol",
      source: "venues",
      filter: ["has", "point_count"],
      layout: {
        "icon-image": [
          "case",
          ["==", ["get", "availableCount"], ["get", "point_count"]],
          "cluster-green",
          ["==", ["get", "availableCount"], 0],
          "cluster-red",
          "cluster-mixed",
        ],
        "icon-size": [
          "step",
          ["get", "point_count"],
          (20 * 2) / CLUSTER_IMAGE_SIZE, // diameter ~40px (< 50 points)
          50,
          (30 * 2) / CLUSTER_IMAGE_SIZE, // diameter ~60px
          100,
          (40 * 2) / CLUSTER_IMAGE_SIZE, // diameter ~80px
        ],
        "icon-anchor": "center",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    })

    // Add cluster count label layer
    map.addLayer({
      id: "cluster-count",
      type: "symbol",
      source: "venues",
      filter: ["has", "point_count"],
      layout: {
        "text-field": "{point_count_abbreviated}",
        "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
        "text-size": 12,
      },
      paint: {
        "text-color": "#ffffff",
      },
    })

    // Add unclustered point layer (individual pins) - color-coded by availability
    map.addLayer({
      id: "unclustered-point",
      type: "circle",
      source: "venues",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": [
          "case",
          ["==", ["get", "availabilityLabel"], "Available now"],
          "#0F5132", // Dark green for available
          "#991b1b", // Dark red for unavailable
        ],
        "circle-radius": 8,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    }, "cluster-count")

    // Add price label layer above pins (only for available venues)
    map.addLayer({
      id: "price-label",
      type: "symbol",
      source: "venues",
      filter: ["!", ["has", "point_count"]],
      layout: {
        "text-field": ["concat", ["get", "name"], "\n", "From $", ["to-string", ["get", "minPrice"]], "/hr"],
        "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
        "text-size": 11,
        "text-anchor": "bottom",
        "text-offset": [0, -2],
        "text-max-width": 8,
      },
      paint: {
        "text-color": "#1f2937",
        "text-halo-color": "#ffffff",
        "text-halo-width": 2,
        "text-halo-blur": 1,
      },
    }, "unclustered-point")

    // Click handler for clusters - zoom in to expand
    map.on("click", "clusters", (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ["clusters"],
      })
      const clusterId = features[0].properties?.cluster_id
      if (clusterId !== undefined) {
        const source = map.getSource("venues") as mapboxgl.GeoJSONSource
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || zoom == null) return

          const coordinates = (features[0].geometry as { type: "Point"; coordinates: [number, number] }).coordinates
          map.easeTo({
            center: [coordinates[0], coordinates[1]],
            zoom,
            duration: 500,
          })
        })
      }
    })

    // Click handler for individual pins
    map.on("click", "unclustered-point", (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ["unclustered-point"],
      })
      if (features.length > 0) {
        const venueId = features[0].properties?.id
        if (venueId && onSelectVenueRef.current) {
          onSelectVenueRef.current(venueId)
        }
      }
    })


    // Change cursor on hover
    map.on("mouseenter", "clusters", () => {
      map.getCanvas().style.cursor = "pointer"
    })
    map.on("mouseleave", "clusters", () => {
      map.getCanvas().style.cursor = ""
    })
    map.on("mouseenter", "unclustered-point", () => {
      map.getCanvas().style.cursor = "pointer"
    })
    map.on("mouseleave", "unclustered-point", () => {
      map.getCanvas().style.cursor = ""
    })
  }

  useEffect(() => {
    if (!accessToken || accessToken === "your_mapbox_token_here") {
      console.error("❌ Mapbox access token not configured")
      setMapError(
        "Mapbox access token not configured. Please add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to your .env file with a valid Mapbox token."
      )
      setIsLoading(false)
      return
    }

    if (!mapContainerRef.current || mapRef.current) {
      return
    }

    mapboxgl.accessToken = accessToken

    // Determine center: prioritize user location ONLY if user hasn't interacted, then first venue, then NYC
    // CRITICAL: If user is searching area, preserve current map state - don't reset to default
    let center: [number, number] = [NYC_CENTER.lng, NYC_CENTER.lat]
    let zoom = DEFAULT_ZOOM

    // PRIMARY GUARD: If user is searching area, don't reset map - it should already be positioned
    if (isSearchingAreaRef.current && mapRef.current) {
      // Map already exists and user is searching - don't create a new one
      // This should never happen due to the check above, but adding as safety
      return
    }

    if (userLocation && !hasUserInteractedWithMapRef.current) {
      // Only center on userLocation if user hasn't interacted with the map yet
      center = [userLocation.lng, userLocation.lat]
      zoom = 14
    } else {
      // User has interacted OR no userLocation - use first venue or NYC
      const validVenues = venues.filter((v) => v.latitude !== null && v.longitude !== null)
      if (validVenues.length > 0) {
        center = [validVenues[0].longitude!, validVenues[0].latitude!]
        zoom = DEFAULT_ZOOM
      }
    }

    try {
      const map = new mapboxgl.Map({
        container: mapContainerRef.current!,
        style: "mapbox://styles/mapbox/light-v11",
        center,
        zoom,
        attributionControl: false,
      })

      map.addControl(
        new mapboxgl.AttributionControl({
          compact: true,
          customAttribution: "© Nooc",
        })
      )

      map.addControl(
        new mapboxgl.NavigationControl({
          showCompass: false,
          showZoom: false,
        })
      )

      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current)
      }
      loadTimeoutRef.current = setTimeout(() => {
        setMapError("Map took too long to load. Please check your Mapbox token and network connection.")
        setIsLoading(false)
      }, 10000)

      map.on("load", async () => {
        hasMapLoadedOnceRef.current = true
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current)
          loadTimeoutRef.current = null
        }

        try {
          const layers = map.getStyle().layers

          layers.forEach((layer) => {
            if (layer.type === "symbol" && layer.id.includes("road") && layer.id.includes("label")) {
              try {
                map.setLayoutProperty(layer.id, "visibility", "visible")
                map.setPaintProperty(layer.id, "text-color", "#5c6b66")
                map.setPaintProperty(layer.id, "text-halo-color", "#ffffff")
                map.setPaintProperty(layer.id, "text-halo-width", 1.5)
                map.setPaintProperty(layer.id, "text-halo-blur", 1)
              } catch (e) {
                // Layer might not support this property
              }
            }

            if (
              layer.type === "symbol" &&
              (layer.id.includes("poi") || (layer.id.includes("place") && !layer.id.includes("road")))
            ) {
              try {
                map.setLayoutProperty(layer.id, "visibility", "none")
              } catch (e) {
                // Layer might not exist
              }
            }
          })

          try {
            if (map.getLayer("water")) {
              map.setPaintProperty("water", "fill-color", "#e8f5e9")
            }
            const roadLayers = ["road", "road-street", "road-primary", "road-secondary"]
            roadLayers.forEach((layerName) => {
              try {
                if (map.getLayer(layerName)) {
                  map.setPaintProperty(layerName, "line-color", "#faf9f7")
                }
              } catch (e) {
                // Layer might not exist
              }
            })
          } catch (e) {
            // Layer might not exist
          }

          // Helper: hide loading overlay only after map has painted (so icons are visible)
          const clearLoadingAfterPaint = () => {
            map.once("idle", () => setIsLoading(false))
          }

          // Load pin image
          if (!pinImageLoadedRef.current) {
            try {
              const pinImageDataUrl = createPinImage()
              // Create Image object from data URL
              const img = new Image()
              img.onload = () => {
                try {
                  map.addImage("venue-pin", img)
                  pinImageLoadedRef.current = true
                  
                  // If source already exists, ensure unclustered layer exists
                  if (map.getSource("venues")) {
                    if (!map.getLayer("unclustered-point")) {
                      try {
                        map.addLayer({
                          id: "unclustered-point",
                          type: "circle",
                          source: "venues",
                          filter: ["!", ["has", "point_count"]],
                          paint: {
                            "circle-color": [
                              "case",
                              ["==", ["get", "availabilityLabel"], "Available now"],
                              "#22c55e", // Green for available
                              "#ef4444", // Red for unavailable
                            ],
                            "circle-radius": 8,
                            "circle-stroke-width": 2,
                            "circle-stroke-color": "#ffffff",
                          },
                        }, "cluster-count")
                        // Add price label layer (only for available venues)
                        if (!map.getLayer("price-label")) {
                          map.addLayer({
                            id: "price-label",
                            type: "symbol",
                            source: "venues",
                            filter: ["!", ["has", "point_count"]],
                            layout: {
                              "text-field": ["concat", ["get", "name"], "\n", "From $", ["to-string", ["get", "minPrice"]], "/hr"],
                              "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
                              "text-size": 11,
                              "text-anchor": "bottom",
                              "text-offset": [0, -2],
                              "text-max-width": 8,
                            },
                            paint: {
                              "text-color": "#1f2937",
                              "text-halo-color": "#ffffff",
                              "text-halo-width": 2,
                              "text-halo-blur": 1,
                            },
                          }, "unclustered-point")
                        }
                      } catch (error) {
                        console.error("Error adding unclustered point layer:", error)
                      }
                    }
                    if (venues.length > 0) clearLoadingAfterPaint()
                  } else {
                    // Only add venues source when we have venues (avoid clearing loading on empty map)
                    if (venues.length > 0) {
                      initializeVenuesSource(map)
                      clearLoadingAfterPaint()
                    }
                  }
                } catch (error) {
                  console.error("Error adding pin image to map:", error)
                  setIsLoading(false)
                }
              }
              img.onerror = (error) => {
                console.error("Error loading pin image:", error)
                setIsLoading(false)
              }
              img.src = pinImageDataUrl
            } catch (error) {
              console.error("Error creating pin image:", error)
              setIsLoading(false)
            }
          } else {
            // Only add venues source when we have venues (avoid clearing loading on empty map)
            if (venues.length > 0) {
              initializeVenuesSource(map)
              clearLoadingAfterPaint()
            }
          }

          // Store initial bounds and report once for bounded initial fetch
          const bounds = map.getBounds()
          if (bounds) {
            const initialBounds = {
              north: bounds.getNorth(),
              south: bounds.getSouth(),
              east: bounds.getEast(),
              west: bounds.getWest(),
            }
            currentBoundsRef.current = initialBounds
            if (!hasReportedInitialBoundsRef.current && onInitialBoundsRef.current) {
              hasReportedInitialBoundsRef.current = true
              onInitialBoundsRef.current(initialBounds)
            }
          }

          // Add user location marker if available
          if (userLocation) {
            addUserLocationMarker(map, userLocation)
            // If user location is available, we already centered on it, so mark fit bounds as done
            hasFitBoundsRef.current = true
          }

          // Fit bounds on initial load if needed
          // PRIMARY GUARD: Never fit bounds if user is searching area
          if (isSearchingAreaRef.current) {
            // Skip fitBounds during area search - preserve map view
            return
          }
          // Don't fit bounds if user has interacted
          const shouldFitInitial = !hasFitBoundsRef.current && venues.length > 0 && !userLocation && !hasUserInteractedWithMapRef.current
          if (shouldFitInitial) {
            const bounds = new mapboxgl.LngLatBounds()
            venues.forEach((venue) => {
              if (venue.latitude !== null && venue.longitude !== null) {
                bounds.extend([venue.longitude, venue.latitude])
              }
            })
            if (!bounds.isEmpty()) {
              map.fitBounds(bounds, {
                padding: 50,
                maxZoom: 16,
              })
              hasFitBoundsRef.current = true
            }
          }
          
          // If venues changed while map was loading, update them now
          if (venuesRef.current.length > 0) {
            const source = map.getSource("venues") as mapboxgl.GeoJSONSource | null
            if (source) {
              const venuesGeoJSON = venuesToGeoJSON(venuesRef.current)
              console.log("🗺️ Updating map with", venuesRef.current.length, "venues (on map load)")
              source.setData(venuesGeoJSON)
              const mapForRepaint = mapRef.current
              if (mapForRepaint) {
                mapForRepaint.once("sourcedata", (e: mapboxgl.MapSourceDataEvent) => {
                  if (e.sourceId === "venues" && mapRef.current?.loaded()) {
                    forceMapRepaint(mapRef.current)
                  }
                })
                mapForRepaint.once("idle", () => {
                  if (mapRef.current?.loaded()) forceMapRepaint(mapRef.current)
                })
                forceMapRepaint(mapForRepaint)
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    if (mapRef.current?.loaded()) forceMapRepaint(mapRef.current)
                  })
                })
              }
              
              // Fit bounds if shouldFitBounds is true (filters were actively changed) or if initializing
              // PRIMARY GUARD: Never fit bounds if user is searching area
              if (isSearchingAreaRef.current) {
                // Skip fitBounds during area search - preserve map view
                return
              }
              // Don't fit bounds if skipFitBounds is true or user has interacted
              // Only use lastVenuesCount === 0 for initial load if map hasn't loaded yet and user hasn't interacted
              const isInitializing = lastVenuesCountRef.current === 0 && !hasMapLoadedOnceRef.current && !hasUserInteractedWithMapRef.current
              const shouldFit = !skipFitBoundsRef.current && !hasUserInteractedWithMapRef.current && (shouldFitBounds === true || isInitializing)
              if (shouldFit) {
                const venuesWithLocation = venuesRef.current.filter(v => v.latitude != null && v.longitude != null)
                if (venuesWithLocation.length > 0) {
                  const bounds = new mapboxgl.LngLatBounds()
                  venuesWithLocation.forEach(venue => {
                    bounds.extend([venue.longitude!, venue.latitude!])
                  })
                  if (!bounds.isEmpty()) {
                    map.fitBounds(bounds, {
                      padding: 50,
                      maxZoom: venuesWithLocation.length === 1 ? 15 : 16,
                      duration: 500,
                    })
                    lastVenuesCountRef.current = venuesRef.current.length
                    if (onBoundsFitted) {
                      onBoundsFitted()
                    }
                  }
                }
              }
            } else {
              // Initialize venues source now that map is loaded
              initializeVenuesSource(map)
            }
          }
        } catch (error) {
          console.error("❌ Error styling map:", error)
          setIsLoading(false)
        }
      })

      // Track map bounds changes
      const handleMoveEnd = () => {
        if (!map.loaded()) return

        const bounds = map.getBounds()
        if (!bounds) return
        const newBounds = {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        }

        if (process.env.NODE_ENV !== "production") {
          const center = map.getCenter()
          console.log("[Explore map] moveend", {
            center: { lat: center.lat, lng: center.lng },
            zoom: map.getZoom(),
            bounds: newBounds,
          })
        }
        onBoundsChangeRef.current?.(newBounds)

        // Initialize currentBoundsRef if it doesn't exist
        if (!currentBoundsRef.current) {
          currentBoundsRef.current = newBounds
          // Mark interaction immediately on first moveend after initialization
          // This ensures auto-center is disabled as soon as user finishes moving the map
          hasUserInteractedWithMapRef.current = true
          return
        }

        // Mark that user has interacted with the map (manually moved/zoomed)
        const threshold = 0.0001 // Very small threshold for more sensitive detection
        const hasChanged =
          Math.abs(newBounds.north - currentBoundsRef.current.north) > threshold ||
          Math.abs(newBounds.south - currentBoundsRef.current.south) > threshold ||
          Math.abs(newBounds.east - currentBoundsRef.current.east) > threshold ||
          Math.abs(newBounds.west - currentBoundsRef.current.west) > threshold
        
        if (hasChanged) {
          hasUserInteractedWithMapRef.current = true
        }

        if (hasChanged && onSearchArea) {
          debouncedShowSearchButton()
        }
      }

      const handleMove = () => {
        if (!map.loaded()) return

        const bounds = map.getBounds()
        if (!bounds) return
        const newBounds = {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        }

        // Initialize currentBoundsRef if it doesn't exist
        if (!currentBoundsRef.current) {
          currentBoundsRef.current = newBounds
          // Mark interaction immediately on first move after initialization
          // This ensures auto-center is disabled as soon as user starts moving the map
          hasUserInteractedWithMapRef.current = true
          return
        }

        // Mark that user has interacted with the map (manually moved/zoomed)
        const threshold = 0.0001
        const hasChanged =
          Math.abs(newBounds.north - currentBoundsRef.current.north) > threshold ||
          Math.abs(newBounds.south - currentBoundsRef.current.south) > threshold ||
          Math.abs(newBounds.east - currentBoundsRef.current.east) > threshold ||
          Math.abs(newBounds.west - currentBoundsRef.current.west) > threshold
        
        if (hasChanged) {
          hasUserInteractedWithMapRef.current = true
        }

        if (hasChanged && onSearchArea) {
          debouncedShowSearchButton()
        }
      }

      map.on("move", handleMove)
      map.on("moveend", handleMoveEnd)
      map.on("zoomend", handleMoveEnd)

      const handleMapClick = (e: mapboxgl.MapMouseEvent) => {
        if (!map.loaded()) return
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["clusters", "unclustered-point"],
        })
        if (features.length === 0 && onMapClickRef.current) {
          onMapClickRef.current()
        }
      }
      map.on("click", handleMapClick)

      map.on("error", (e: any) => {
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current)
          loadTimeoutRef.current = null
        }
        console.error("❌ Mapbox error:", e)
        setMapError(`Failed to load map: ${e.error?.message || e.message || "Unknown error"}`)
        setIsLoading(false)
      })

      map.on("style.error", (e: any) => {
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current)
          loadTimeoutRef.current = null
        }
        console.error("❌ Map style error:", e)
        setMapError(`Failed to load map style: ${e.error?.message || "Unknown error"}. Check your Mapbox token.`)
        setIsLoading(false)
      })

      map.on("idle", () => {
        if (isLoading && map.loaded() && map.getStyle()) {
          // Only clear loading when venues source exists and has venues (avoid empty map flash)
          if (!map.getSource("venues")) return
          if (venuesRef.current.length === 0) return
          if (loadTimeoutRef.current) {
            clearTimeout(loadTimeoutRef.current)
            loadTimeoutRef.current = null
          }
          try {
            const layers = map.getStyle().layers
            layers.forEach((layer) => {
              if (layer.type === "symbol" && layer.id.includes("road") && layer.id.includes("label")) {
                try {
                  map.setLayoutProperty(layer.id, "visibility", "visible")
                  map.setPaintProperty(layer.id, "text-color", "#5c6b66")
                  map.setPaintProperty(layer.id, "text-halo-color", "#ffffff")
                  map.setPaintProperty(layer.id, "text-halo-width", 1.5)
                  map.setPaintProperty(layer.id, "text-halo-blur", 1)
                } catch (e) {}
              }
              if (
                layer.type === "symbol" &&
                (layer.id.includes("poi") || (layer.id.includes("place") && !layer.id.includes("road")))
              ) {
                try {
                  map.setLayoutProperty(layer.id, "visibility", "none")
                } catch (e) {}
              }
            })
            setIsLoading(false)
          } catch (error) {
            console.error("❌ Error initializing via idle:", error)
          }
        }
      })

      mapRef.current = map

      return () => {
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current)
          loadTimeoutRef.current = null
        }
        if (userLocationMarkerRef.current) {
          userLocationMarkerRef.current.remove()
          userLocationMarkerRef.current = null
        }
        if (mapRef.current) {
          // Remove event listeners (handleMapClick is in closure; off uses same reference)
          const m = mapRef.current as any
          m.off("click", "clusters")
          m.off("click", "unclustered-point")
          m.off("mouseenter", "clusters")
          m.off("mouseleave", "clusters")
          m.off("mouseenter", "unclustered-point")
          m.off("mouseleave", "unclustered-point")
          m.off("click", handleMapClick)
          m.off("moveend", handleMoveEnd)
          m.off("zoomend", handleMoveEnd)
          m.remove()
          mapRef.current = null
        }
      }
    } catch (error) {
      console.error("Error initializing Mapbox:", error)
      setMapError("Failed to initialize map")
      setIsLoading(false)
    }
  }, [accessToken]) // Map should only initialize once when accessToken is available, not when userLocation changes


  const addUserLocationMarker = (map: mapboxgl.Map, location: { lat: number; lng: number }) => {
    if (userLocationMarkerRef.current) {
      userLocationMarkerRef.current.remove()
      userLocationMarkerRef.current = null
    }
    const el = document.createElement("div")
    el.className = "user-location-marker"
    
    // Create outer pulsing ring
    const outerRing = document.createElement("div")
    outerRing.style.width = "24px"
    outerRing.style.height = "24px"
    outerRing.style.borderRadius = "50%"
    outerRing.style.backgroundColor = "rgba(15, 81, 50, 0.2)" // Green with transparency (#0F5132)
    outerRing.style.border = "2px solid rgba(15, 81, 50, 0.4)"
    outerRing.style.position = "absolute"
    outerRing.style.top = "50%"
    outerRing.style.left = "50%"
    outerRing.style.transform = "translate(-50%, -50%)"
    outerRing.style.animation = "pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
    
    // Create inner solid dot
    const innerDot = document.createElement("div")
    innerDot.style.width = "12px"
    innerDot.style.height = "12px"
    innerDot.style.borderRadius = "50%"
    innerDot.style.backgroundColor = "#0F5132" // Green (same as venue pins)
    innerDot.style.border = "2px solid #ffffff"
    innerDot.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)"
    innerDot.style.position = "absolute"
    innerDot.style.top = "50%"
    innerDot.style.left = "50%"
    innerDot.style.transform = "translate(-50%, -50%)"
    innerDot.style.zIndex = "1"
    
    // Container for both elements
    el.style.width = "24px"
    el.style.height = "24px"
    el.style.position = "relative"
    el.style.cursor = "default"
    el.appendChild(outerRing)
    el.appendChild(innerDot)
    
    // Add CSS animation if not already added
    if (!document.getElementById("user-location-pulse-style")) {
      const style = document.createElement("style")
      style.id = "user-location-pulse-style"
      style.textContent = `
        @keyframes pulse-ring {
          0%, 100% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            opacity: 0.5;
            transform: translate(-50%, -50%) scale(1.5);
          }
        }
      `
      document.head.appendChild(style)
    }

    userLocationMarkerRef.current = new mapboxgl.Marker(el)
      .setLngLat([location.lng, location.lat])
      .addTo(map)
  }

  // Update user location marker when userLocation changes
  useEffect(() => {
    if (mapRef.current && userLocation && !isLoading) {
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.remove()
      }
      addUserLocationMarker(mapRef.current, userLocation)
    }
  }, [userLocation, isLoading])

  useEffect(() => {
    if (!centerOnVenueId || !mapRef.current) return

    let targetLat: number | null = null
    let targetLng: number | null = null

    if (centerOnCoordinates) {
      targetLat = centerOnCoordinates.lat
      targetLng = centerOnCoordinates.lng
    } else {
      const venue = venues.find(
        (v) => v.id === centerOnVenueId && v.latitude != null && v.longitude != null
      )
      if (venue) {
        targetLat = venue.latitude!
        targetLng = venue.longitude!
      }
    }

    if (targetLat == null || targetLng == null) return

    let timeoutId: NodeJS.Timeout | null = null;

    const tryNavigate = () => {
      if (!mapRef.current || !mapRef.current.loaded()) {
        timeoutId = setTimeout(tryNavigate, 100);
        return;
      }

      mapRef.current.flyTo({
        center: [targetLng, targetLat],
        zoom: 20,
        duration: 600,
      });
    };

    tryNavigate();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [centerOnVenueId, centerOnCoordinates, venues])

  // Store venues in a ref so we can access latest value in intervals/callbacks
  const venuesRef = useRef(venues)
  const previousVenueIdsRef = useRef<string[]>(venues.map(v => v.id).sort())
  
  useEffect(() => {
    venuesRef.current = venues
  }, [venues])

  // Helper function to force map repaint after data update
  // Called synchronously immediately after setData() to ensure instant repaint
  const forceMapRepaint = (map: mapboxgl.Map) => {
    // Production-only issue: markers don't appear after text search
    // This is a rendering trigger, exact mechanism TBD
    if (!map || !map.loaded()) return

    // Trigger repaint by firing moveend event
    map.fire('moveend')
  }
  
  // Store shouldFitBounds in a ref so we can access latest value in intervals/callbacks
  const shouldFitBoundsRef = useRef(shouldFitBounds)
  useEffect(() => {
    shouldFitBoundsRef.current = shouldFitBounds
  }, [shouldFitBounds])

  // Update venues source when venues change
  useEffect(() => {
    if (didAreaSearch) pendingAreaSearchRepaintRef.current = true
    
    if (!mapRef.current) {
      return
    }

    // Clear loading overlay after map has painted venue data (so icons are visible)
    const clearLoadingAfterPaintIfNeeded = () => {
      if (isLoading && mapRef.current?.loaded()) {
        mapRef.current.once("idle", () => setIsLoading(false))
      }
    }
    
    // Don't skip if isLoading - we can still queue the update
    // The map will update once it's ready

    // Wait for map to be ready (use a small delay if not loaded yet)
    if (!mapRef.current.loaded()) {
      // When map reports loaded() false but we have pending area-search repaint, run setData + repaint after delay (map.loaded() may never become true in some setups)
      if (pendingAreaSearchRepaintRef.current) {
        let attempts = 0
        const maxAttempts = 10
        const tryRun = () => {
          attempts += 1
          if (!pendingAreaSearchRepaintRef.current) return
          const m = mapRef.current
          const src = m?.getSource("venues") as mapboxgl.GeoJSONSource | null
          if (src && m) {
            const currentVenues = venuesRef.current
            const geo = venuesToGeoJSON(currentVenues)
            src.setData(geo)
            pendingAreaSearchRepaintRef.current = false
            try {
              const z = m.getZoom()
              m.setZoom(z - 0.001)
              requestAnimationFrame(() => { if (mapRef.current) mapRef.current.setZoom(z) })
            } catch (_) {}
            return
          }
          if (attempts < maxAttempts) {
            const t2 = setTimeout(tryRun, 200)
            timeouts.push(t2)
          }
        }
        const timeouts: ReturnType<typeof setTimeout>[] = []
        const t = setTimeout(tryRun, 300)
        timeouts.push(t)
        return () => timeouts.forEach((id) => clearTimeout(id))
      }
      
      // Set up interval to check when map loads
      const checkLoaded = setInterval(() => {
        if (mapRef.current?.loaded()) {
          clearInterval(checkLoaded)
          const source = mapRef.current.getSource("venues") as mapboxgl.GeoJSONSource | null
          if (source) {
            // Use latest venues from ref (which will be updated by the venuesRef useEffect)
            const currentVenues = venuesRef.current
            // Always update source (including empty) so markers clear when search returns 0
            const venuesGeoJSON = venuesToGeoJSON(currentVenues)
            console.log("🗺️ Updating map with", currentVenues.length, "venues (after wait)")
            source.setData(venuesGeoJSON)
            clearLoadingAfterPaintIfNeeded()
            const mapForRepaint = mapRef.current
            if (mapForRepaint) {
              mapForRepaint.once("sourcedata", (e: mapboxgl.MapSourceDataEvent) => {
                if (e.sourceId === "venues" && mapRef.current?.loaded()) {
                  forceMapRepaint(mapRef.current)
                }
              })
              mapForRepaint.once("idle", () => {
                if (mapRef.current?.loaded()) forceMapRepaint(mapRef.current)
              })
              forceMapRepaint(mapForRepaint)
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  if (mapRef.current?.loaded()) forceMapRepaint(mapRef.current)
                })
              })
            }
            
            // If area search just finished (ref persists after prop clears), force repaint with unified function
            if (pendingAreaSearchRepaintRef.current) {
              pendingAreaSearchRepaintRef.current = false
              if (mapRef.current?.loaded()) {
                forceMapRepaint(mapRef.current)
              }
              return
            }
            // Use ref to get latest value
            // Don't fit bounds if skipFitBounds is true or user has interacted
            // Only use lastVenuesCount === 0 for initial load if map hasn't loaded yet and user hasn't interacted
            const isInitializing = lastVenuesCountRef.current === 0 && !hasMapLoadedOnceRef.current && !hasUserInteractedWithMapRef.current
            const shouldFit = !skipFitBoundsRef.current && !hasUserInteractedWithMapRef.current && (shouldFitBoundsRef.current === true || isInitializing)
            if (shouldFit) {
              const venuesWithLocation = currentVenues.filter(v => v.latitude != null && v.longitude != null)
              if (venuesWithLocation.length > 0) {
                const bounds = new mapboxgl.LngLatBounds()
                venuesWithLocation.forEach(venue => {
                  bounds.extend([venue.longitude!, venue.latitude!])
                })
                if (!bounds.isEmpty()) {
                  mapRef.current.fitBounds(bounds, {
                    padding: 50,
                    maxZoom: venuesWithLocation.length === 1 ? 15 : 16,
                    duration: 500,
                  })
                  lastVenuesCountRef.current = currentVenues.length
                  if (onBoundsFitted) {
                    onBoundsFitted()
                  }
                }
              }
            }
          } else {
            // Source doesn't exist; only add when we have venues (avoid empty map flash)
            const currentVenues = venuesRef.current
            if (!isSearchingAreaRef.current && currentVenues.length > 0) {
              console.log("🗺️ Initializing venues source (after wait)")
              initializeVenuesSource(mapRef.current)
              clearLoadingAfterPaintIfNeeded()
              const currentVenueIds = currentVenues.map(v => v.id).sort()
              previousVenueIdsRef.current = currentVenueIds
            } else if (currentVenues.length === 0) {
              // No venues yet; loading overlay stays
            } else {
              // During area search, skip initialization to preserve map view
              console.log("🗺️ Skipping source initialization during area search")
            }
          }
        }
      }, 100)
      
      // Also listen for the load event as a backup
      const handleLoad = () => {
        hasMapLoadedOnceRef.current = true
        clearInterval(checkLoaded)
        const source = mapRef.current?.getSource("venues") as mapboxgl.GeoJSONSource | null
        if (source && mapRef.current) {
          const currentVenues = venuesRef.current
          // Always update source (including empty) so markers clear when search returns 0
          const venuesGeoJSON = venuesToGeoJSON(currentVenues)
          console.log("🗺️ Updating map with", currentVenues.length, "venues (on load event)")
          source.setData(venuesGeoJSON)
          clearLoadingAfterPaintIfNeeded()
          const mapForRepaint = mapRef.current
          if (mapForRepaint) {
            mapForRepaint.once("sourcedata", (e: mapboxgl.MapSourceDataEvent) => {
              if (e.sourceId === "venues" && mapRef.current?.loaded()) {
                forceMapRepaint(mapRef.current)
              }
            })
            mapForRepaint.once("idle", () => {
              if (mapRef.current?.loaded()) forceMapRepaint(mapRef.current)
            })
            forceMapRepaint(mapForRepaint)
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                if (mapRef.current?.loaded()) forceMapRepaint(mapRef.current)
              })
            })
          }
          
          // If area search just finished (ref persists after prop clears), force repaint with micro-zoom
          if (pendingAreaSearchRepaintRef.current) {
            pendingAreaSearchRepaintRef.current = false
            const m = mapRef.current
            if (m?.loaded()) {
              const z = m.getZoom()
              m.setZoom(z - 0.001)
              requestAnimationFrame(() => {
                if (mapRef.current?.loaded()) mapRef.current.setZoom(z)
              })
            }
            return
          }
          // Use ref to get latest value
          // Don't fit bounds if skipFitBounds is true or user has interacted
          // Only use lastVenuesCount === 0 for initial load if map hasn't loaded yet and user hasn't interacted
          const isInitializing = lastVenuesCountRef.current === 0 && !hasMapLoadedOnceRef.current && !hasUserInteractedWithMapRef.current
          const shouldFit = !skipFitBoundsRef.current && !hasUserInteractedWithMapRef.current && (shouldFitBoundsRef.current === true || isInitializing)
          // Mark that map has loaded at least once
          hasMapLoadedOnceRef.current = true
          if (shouldFit) {
            const venuesWithLocation = currentVenues.filter(v => v.latitude != null && v.longitude != null)
            if (venuesWithLocation.length > 0) {
              const bounds = new mapboxgl.LngLatBounds()
              venuesWithLocation.forEach(venue => {
                bounds.extend([venue.longitude!, venue.latitude!])
              })
              if (!bounds.isEmpty()) {
                mapRef.current.fitBounds(bounds, {
                  padding: 50,
                  maxZoom: venuesWithLocation.length === 1 ? 15 : 16,
                  duration: 500,
                })
                lastVenuesCountRef.current = currentVenues.length
                if (onBoundsFitted) {
                  onBoundsFitted()
                }
              }
            }
          }
        }
      }
      mapRef.current.once("load", handleLoad)
      
      return () => {
        clearInterval(checkLoaded)
        mapRef.current?.off("load", handleLoad)
      }
    }

    // If pin image should be loaded but isn't in map, reload it
    if (pinImageLoadedRef.current && !mapRef.current.hasImage("venue-pin")) {
      try {
        const pinImageDataUrl = createPinImage()
        const img = new Image()
        img.onload = () => {
          if (mapRef.current) {
            mapRef.current.addImage("venue-pin", img)
            // Now initialize or update source
            const source = mapRef.current.getSource("venues") as mapboxgl.GeoJSONSource | null
            if (source) {
              // Always update source (including empty) so markers clear when search returns 0
              const venuesGeoJSON = venuesToGeoJSON(venues)
              console.log("🗺️ Updating map with", venues.length, "venues (after pin reload)")
              source.setData(venuesGeoJSON)
              clearLoadingAfterPaintIfNeeded()
              const mapForRepaint = mapRef.current
              if (mapForRepaint) {
                mapForRepaint.once("sourcedata", (e: mapboxgl.MapSourceDataEvent) => {
                  if (e.sourceId === "venues" && mapRef.current?.loaded()) {
                    forceMapRepaint(mapRef.current)
                  }
                })
                mapForRepaint.once("idle", () => {
                  if (mapRef.current?.loaded()) forceMapRepaint(mapRef.current)
                })
                forceMapRepaint(mapForRepaint)
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    if (mapRef.current?.loaded()) forceMapRepaint(mapRef.current)
                  })
                })
              }
            } else {
              // Only add source when we have venues (avoid empty map flash)
              if (!isSearchingAreaRef.current && venues.length > 0) {
                initializeVenuesSource(mapRef.current)
                clearLoadingAfterPaintIfNeeded()
              } else if (venues.length === 0) {
                // No venues yet; loading overlay stays
              } else {
                // During area search, skip initialization to preserve map view
                console.log("🗺️ Skipping source initialization during area search (pin reload)")
              }
            }
          }
        }
        img.src = pinImageDataUrl
      } catch (error) {
        console.error("Error reloading pin image:", error)
      }
      return
    }

    const source = mapRef.current.getSource("venues") as mapboxgl.GeoJSONSource | null
    
    // Detect if this is a significant change (different venue set, e.g., filter applied)
    const currentVenueIds = venues.map(v => v.id).sort()
    const previousVenueIds = previousVenueIdsRef.current
    
    // Compare current vs previous to detect significant changes
    const isSignificantChange = 
      previousVenueIds.length === 0 || // First load
      currentVenueIds.length !== previousVenueIds.length ||
      !currentVenueIds.every((id, index) => id === previousVenueIds[index])
    
    if (source) {
      if (isSignificantChange) {
        // Significant change (e.g., filter applied) - force full refresh
        // Remove existing source and layers, then re-initialize
        // This ensures a complete refresh rather than trying to update in place
        // PRIMARY GUARD: NEVER re-initialize if user is searching area - just update the data
        if (didAreaSearch) {
          // Area search just finished: list is accurate. Update source and refresh map by fitting to results.
          const venuesGeoJSON = venuesToGeoJSON(venues)
          source.setData(venuesGeoJSON)
          clearLoadingAfterPaintIfNeeded()
          previousVenueIdsRef.current = currentVenueIds
          lastVenuesCountRef.current = venues.length

          // Force repaint immediately after setData using unified function
          const map = mapRef.current
          if (map?.loaded()) {
            forceMapRepaint(map)
            // Delayed retries for area search reliability
            setTimeout(() => { if (mapRef.current?.loaded()) forceMapRepaint(mapRef.current) }, 50)
            setTimeout(() => { if (mapRef.current?.loaded()) forceMapRepaint(mapRef.current) }, 200)
          }
          return
        } else if (!hasUserInteractedWithMapRef.current) {
          // Only re-initialize if user hasn't interacted (e.g., filter change on initial load)
          initializeVenuesSource(mapRef.current)
          clearLoadingAfterPaintIfNeeded()
        } else {
          // Just update the data without re-initializing to preserve map view
          const venuesGeoJSON = venuesToGeoJSON(venues)
          source.setData(venuesGeoJSON)
          clearLoadingAfterPaintIfNeeded()
          previousVenueIdsRef.current = currentVenueIds
          lastVenuesCountRef.current = venues.length
          const mapForRepaint = mapRef.current
          if (mapForRepaint) {
            mapForRepaint.once("sourcedata", (e: mapboxgl.MapSourceDataEvent) => {
              if (e.sourceId === "venues" && mapRef.current?.loaded()) {
                forceMapRepaint(mapRef.current)
              }
            })
            mapForRepaint.once("idle", () => {
              if (mapRef.current?.loaded()) forceMapRepaint(mapRef.current)
            })
            forceMapRepaint(mapForRepaint)
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                if (mapRef.current?.loaded()) forceMapRepaint(mapRef.current)
              })
            })
          }
          return
        }
        
        // Update the ref to track the new venue set AFTER refresh
        previousVenueIdsRef.current = currentVenueIds
        
        // Fit bounds if explicitly requested (filters were actively changed)
        // PRIMARY GUARD: Never fit bounds if user is searching area
        if (didAreaSearch) {
          // Skip fitBounds during area search - preserve map view
          // Continue to update venue data but don't change map view
        } else {
          // Don't fit bounds if skipFitBounds is true or user has interacted
          const venuesWithLocation = venues.filter(v => v.latitude != null && v.longitude != null)
          const shouldFitBoundsCheck = venuesWithLocation.length > 0 && shouldFitBounds === true && !skipFitBoundsRef.current && !hasUserInteractedWithMapRef.current
          if (shouldFitBoundsCheck) {
            const mapLoaded = mapRef.current.loaded()
            if (mapLoaded) {
              const bounds = new mapboxgl.LngLatBounds()
              venuesWithLocation.forEach(venue => {
                bounds.extend([venue.longitude!, venue.latitude!])
              })
              if (!bounds.isEmpty()) {
                mapRef.current.fitBounds(bounds, {
                  padding: 50,
                  maxZoom: venuesWithLocation.length === 1 ? 15 : 16,
                  duration: 500,
                })
                if (onBoundsFitted) {
                  onBoundsFitted()
                }
              }
            }
          }
        }
        
        lastVenuesCountRef.current = venues.length
      } else {
        // Minor update (same venues, different properties) - use setData for efficiency
          // Always update source (including empty) so markers clear when search returns 0
          const venuesGeoJSON = venuesToGeoJSON(venues)
          console.log("🗺️ Minor venue update, using setData:", venues.length, "venues")
        source.setData(venuesGeoJSON)
        clearLoadingAfterPaintIfNeeded()
        const mapForRepaint = mapRef.current
        if (mapForRepaint) {
          mapForRepaint.once("sourcedata", (e: mapboxgl.MapSourceDataEvent) => {
            if (e.sourceId === "venues" && mapRef.current?.loaded()) {
              forceMapRepaint(mapRef.current)
            }
          })
          mapForRepaint.once("idle", () => {
            if (mapRef.current?.loaded()) forceMapRepaint(mapRef.current)
          })
          forceMapRepaint(mapForRepaint)
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (mapRef.current?.loaded()) forceMapRepaint(mapRef.current)
            })
          })
        }
        lastVenuesCountRef.current = venues.length
        // Update ref to track current venue IDs
        previousVenueIdsRef.current = currentVenueIds
      }
      
      
      // Ensure unclustered point layer exists if source exists but layer doesn't
      if (!mapRef.current.getLayer("unclustered-point")) {
        try {
          mapRef.current.addLayer({
            id: "unclustered-point",
            type: "circle",
            source: "venues",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": [
                "case",
                ["==", ["get", "availabilityLabel"], "Available now"],
                "#22c55e", // Green for available
                "#ef4444", // Red for unavailable
              ],
              "circle-radius": 8,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
            },
          }, "cluster-count")
          // Add price label layer (only for available venues)
          if (!mapRef.current.getLayer("price-label")) {
            mapRef.current.addLayer({
              id: "price-label",
              type: "symbol",
              source: "venues",
              filter: ["!", ["has", "point_count"]],
              layout: {
                "text-field": ["concat", ["get", "name"], "\n", "From $", ["to-string", ["get", "minPrice"]], "/hr"],
                "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
                "text-size": 11,
                "text-anchor": "bottom",
                "text-offset": [0, -2],
                "text-max-width": 8,
              },
              paint: {
                "text-color": "#1f2937",
                "text-halo-color": "#ffffff",
                "text-halo-width": 2,
                "text-halo-blur": 1,
              },
            }, "unclustered-point")
          }
        } catch (error) {
          console.error("Error adding missing unclustered point layer:", error)
        }
      }
    } else {
      // Source doesn't exist yet; only add when we have venues (avoid empty map flash)
      if (!isSearchingAreaRef.current && venues.length > 0) {
        console.log("🗺️ Initializing venues source (first time)")
        // initializeVenuesSource will handle adding layers even if pin image isn't loaded
        initializeVenuesSource(mapRef.current)
        clearLoadingAfterPaintIfNeeded()
        previousVenueIdsRef.current = currentVenueIds
      } else if (venues.length === 0) {
        // No venues yet; loading overlay stays until venues useEffect runs with data
      } else {
        // During area search, skip initialization to preserve map view
        console.log("🗺️ Skipping source initialization during area search (first time)")
      }
    }
  }, [venues, isLoading, shouldFitBounds, onBoundsFitted, didAreaSearch])

  const handleSearchArea = () => {
    if (!mapRef.current || !onSearchArea) return

    const bounds = mapRef.current.getBounds()
    if (!bounds) return
    const newBounds = {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[Explore map] Search this area clicked", { bounds: newBounds })
    }
    onBoundsChangeRef.current?.(newBounds)
    currentBoundsRef.current = newBounds
    onSearchArea(newBounds)
  }

  const handleCenterOnMe = () => {
    if (!mapRef.current) return

    // If location is available, center on it
    if (userLocation) {
      mapRef.current.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 14,
        duration: 800, // Smooth animation
      })
      
      // After the animation completes, trigger a search with the new bounds
      mapRef.current.once('moveend', () => {
        if (mapRef.current && onSearchArea) {
          const bounds = mapRef.current.getBounds()
          if (bounds) {
            onSearchArea({
              north: bounds.getNorth(),
              south: bounds.getSouth(),
              east: bounds.getEast(),
              west: bounds.getWest(),
            })
          }
        }
      })
    } else if (onRequestLocation) {
      // If location is not available, request permission
      onRequestLocation()
    }
  }

  // Auto-center on user location when it becomes available (after permission is granted)
  // Don't auto-center if skipFitBounds is true (e.g., when searching by area)
  useEffect(() => {
    // COMPLETELY DISABLE AUTO-CENTER - Single comprehensive check at the start
    // If user has interacted OR we've already auto-centered OR user is searching area, never run auto-center logic
    if (hasUserInteractedWithMapRef.current || hasAutoCenteredRef.current || isSearchingArea) {
      return
    }
    
    if (!mapRef.current || !userLocation || isLoading || !mapRef.current.loaded()) {
      // Reset flag if location is cleared
      if (!userLocation) {
        hasAutoCenteredRef.current = false
      }
      return
    }

    // Never auto-center if we've already auto-centered once
    // This is the primary safeguard - auto-center should only happen once on initial load
    if (hasAutoCenteredRef.current) {
      return
    }

    // Don't auto-center if we're searching by area (skipFitBounds is true)
    // OR if we just finished searching (skipFitBounds was true recently)
    // This prevents auto-center immediately after an area search completes
    if (skipFitBoundsRef.current) {
      return
    }

    // Don't auto-center if user has manually moved/zoomed the map
    // This is the primary safeguard - once user interacts, never auto-center again
    if (hasUserInteractedWithMapRef.current) {
      return
    }

    // Only auto-center once when location is first granted AND user hasn't interacted with the map
    // This ensures we don't auto-center after the user has manually moved the map to search an area
    if (locationState === "granted" && !hasAutoCenteredRef.current && !hasUserInteractedWithMapRef.current) {
      mapRef.current.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 14,
        duration: 800,
      })
      hasAutoCenteredRef.current = true
    }
  }, [userLocation, locationState, isLoading])

  if (mapError) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/50">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">{mapError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={mapContainerRef} className="h-full w-full" style={{ minHeight: "400px", position: "relative" }} />
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/50">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        </div>
      )}
      {/* Initial loading - simple indicator */}
      {!isLoading && isInitialLoading && (
        <div className="absolute top-4 left-1/2 z-20 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full bg-background/95 backdrop-blur-sm px-3 py-1.5 shadow-md border border-border">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-medium text-muted-foreground">Finding venues…</span>
          </div>
        </div>
      )}
      {/* Subtle loading indicator when fetching new pins (map is ready but data is loading) */}
      {!isLoading && !isInitialLoading && isFetchingPins && (
        <div className="absolute top-4 left-1/2 z-20 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full bg-background/95 backdrop-blur-sm px-3 py-1.5 shadow-md border border-border">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-medium text-muted-foreground">Loading venues...</span>
          </div>
        </div>
      )}
      {!isLoading && (
        <div className="absolute right-4 top-20 z-20">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleCenterOnMe}
            disabled={locationState === "requesting"}
            className="shrink-0 h-14 w-14 rounded-2xl border-none bg-white font-bold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] premium-shadow"
            aria-label={userLocation ? "Center on me" : "Enable location"}
          >
            <Navigation size={20} strokeWidth={2.5} className="text-primary/70" />
          </Button>
        </div>
      )}
      {showSearchButton && !isLoading && (
        <div className="absolute top-20 left-1/2 z-20 -translate-x-1/2">
          <Button
            size="sm"
            onClick={handleSearchArea}
            loading={isSearching}
            className="shadow-lg px-3 py-1.5 text-xs"
          >
            {isSearching ? "Searching" : "Search this area"}
          </Button>
        </div>
      )}
    </div>
  )
}
