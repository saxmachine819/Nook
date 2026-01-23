"use client"

import { useEffect, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { Button } from "@/components/ui/button"
import { Navigation } from "lucide-react"

interface Venue {
  id: string
  name: string
  address: string
  latitude: number | null
  longitude: number | null
  minPrice: number
  maxPrice: number
}

interface MapboxMapProps {
  venues: Venue[]
  onSelectVenue?: (id: string) => void
  onMapClick?: () => void
  userLocation?: { lat: number; lng: number } | null
  onSearchArea?: (bounds: { north: number; south: number; east: number; west: number }) => void
  isSearching?: boolean
  centerOnVenueId?: string | null
}

// NYC coordinates (default center)
const NYC_CENTER = { lat: 40.7128, lng: -74.006 }

export function MapboxMap({
  venues,
  onSelectVenue,
  onMapClick,
  userLocation,
  onSearchArea,
  isSearching = false,
  centerOnVenueId,
}: MapboxMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const userLocationMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const currentBoundsRef = useRef<{ north: number; south: number; east: number; west: number } | null>(null)
  const hasFitBoundsRef = useRef<boolean>(false) // Track if we've done initial fitBounds
  const onSelectVenueRef = useRef<((id: string) => void) | undefined>(onSelectVenue) // Keep callback current
  const onMapClickRef = useRef<(() => void) | undefined>(onMapClick)
  const pinImageLoadedRef = useRef<boolean>(false) // Track if pin image has been loaded
  const [isLoading, setIsLoading] = useState(true)
  const [mapError, setMapError] = useState<string | null>(null)
  const [showSearchButton, setShowSearchButton] = useState(false)

  // Keep callback refs up-to-date
  useEffect(() => {
    onSelectVenueRef.current = onSelectVenue
  }, [onSelectVenue])
  useEffect(() => {
    onMapClickRef.current = onMapClick
  }, [onMapClick])

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
      map.removeSource("venues")
    }

    // Add GeoJSON source with clustering
    const venuesGeoJSON = venuesToGeoJSON(venues)
    map.addSource("venues", {
      type: "geojson",
      data: venuesGeoJSON,
      cluster: true,
      clusterRadius: 50,
      clusterMaxZoom: 14,
    })


    // Add cluster circle layer
    map.addLayer({
      id: "clusters",
      type: "circle",
      source: "venues",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#0F5132",
        "circle-radius": [
          "step",
          ["get", "point_count"],
          20, // radius for clusters with < 50 points
          50, 30, // radius for clusters with 50-100 points
          100, 40, // radius for clusters with 100+ points
        ],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
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

    // Add unclustered point layer (individual pins) - simple circle approach
    map.addLayer({
      id: "unclustered-point",
      type: "circle",
      source: "venues",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": "#0F5132",
        "circle-radius": 8,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    }, "cluster-count")

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

    // Determine center: prioritize user location, then first venue, then NYC
    let center: [number, number] = [NYC_CENTER.lng, NYC_CENTER.lat]
    let zoom = 10

    if (userLocation) {
      center = [userLocation.lng, userLocation.lat]
      zoom = 14
    } else {
      const validVenues = venues.filter((v) => v.latitude !== null && v.longitude !== null)
      if (validVenues.length > 0) {
        center = [validVenues[0].longitude!, validVenues[0].latitude!]
        zoom = 12
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
          customAttribution: "© Nook",
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
                            "circle-color": "#0F5132",
                            "circle-radius": 8,
                            "circle-stroke-width": 2,
                            "circle-stroke-color": "#ffffff",
                          },
                        }, "cluster-count")
                      } catch (error) {
                        console.error("Error adding unclustered point layer:", error)
                      }
                    }
                  } else {
                    // Initialize venues source and layers after image is loaded
                    initializeVenuesSource(map)
                  }
                } catch (error) {
                  console.error("Error adding pin image to map:", error)
                }
              }
              img.onerror = (error) => {
                console.error("Error loading pin image:", error)
              }
              img.src = pinImageDataUrl
            } catch (error) {
              console.error("Error creating pin image:", error)
            }
          } else {
            // Image already loaded, initialize venues source
            initializeVenuesSource(map)
          }

          // Store initial bounds
          const bounds = map.getBounds()
          if (bounds) {
            currentBoundsRef.current = {
              north: bounds.getNorth(),
              south: bounds.getSouth(),
              east: bounds.getEast(),
              west: bounds.getWest(),
            }
          }

          // Add user location marker if available
          if (userLocation) {
            addUserLocationMarker(map, userLocation)
            // If user location is available, we already centered on it, so mark fit bounds as done
            hasFitBoundsRef.current = true
          }

          // Fit bounds on initial load if needed
          if (!hasFitBoundsRef.current && venues.length > 0 && !userLocation) {
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

          setIsLoading(false)
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

        // Initialize currentBoundsRef if it doesn't exist
        if (!currentBoundsRef.current) {
          currentBoundsRef.current = newBounds
          return
        }

        // Check if bounds have changed significantly
        const threshold = 0.001 // Small threshold to avoid flickering
        const hasChanged =
          Math.abs(newBounds.north - currentBoundsRef.current.north) > threshold ||
          Math.abs(newBounds.south - currentBoundsRef.current.south) > threshold ||
          Math.abs(newBounds.east - currentBoundsRef.current.east) > threshold ||
          Math.abs(newBounds.west - currentBoundsRef.current.west) > threshold

        if (hasChanged && onSearchArea) {
          setShowSearchButton(true)
        }
      }

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
            // Markers will be added by venues useEffect, don't call addMarkers here
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
  }, [accessToken, userLocation])


  const addUserLocationMarker = (map: mapboxgl.Map, location: { lat: number; lng: number }) => {
    const el = document.createElement("div")
    el.className = "user-location-marker"
    el.style.width = "16px"
    el.style.height = "16px"
    el.style.borderRadius = "50%"
    el.style.backgroundColor = "#0F5132"
    el.style.border = "3px solid #ffffff"
    el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)"
    el.style.cursor = "default"

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

  // Fly to venue when centerOnVenueId is set
  useEffect(() => {
    if (!centerOnVenueId || !mapRef.current || isLoading || !mapRef.current.loaded()) return
    const venue = venues.find(
      (v) => v.id === centerOnVenueId && v.latitude != null && v.longitude != null
    )
    if (!venue) return
    mapRef.current.flyTo({
      center: [venue.longitude!, venue.latitude!],
      zoom: 15,
      duration: 600,
    })
  }, [centerOnVenueId, venues, isLoading])

  // Update venues source when venues change
  useEffect(() => {
    if (!mapRef.current || isLoading || !mapRef.current.loaded()) return

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
              const venuesGeoJSON = venuesToGeoJSON(venues)
              source.setData(venuesGeoJSON)
            } else {
              initializeVenuesSource(mapRef.current)
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
    if (source) {
      const venuesGeoJSON = venuesToGeoJSON(venues)
      source.setData(venuesGeoJSON)
      
      // Ensure unclustered point layer exists if source exists but layer doesn't
      if (!mapRef.current.getLayer("unclustered-point")) {
        try {
          mapRef.current.addLayer({
            id: "unclustered-point",
            type: "circle",
            source: "venues",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": "#0F5132",
              "circle-radius": 8,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
            },
          }, "cluster-count")
        } catch (error) {
          console.error("Error adding missing unclustered point layer:", error)
        }
      }
    } else {
      // Source doesn't exist yet, initialize it
      // initializeVenuesSource will handle adding layers even if pin image isn't loaded
      initializeVenuesSource(mapRef.current)
    }
  }, [venues, isLoading])

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

    currentBoundsRef.current = newBounds
    setShowSearchButton(false)
    onSearchArea(newBounds)
  }

  const handleCenterOnMe = () => {
    if (!mapRef.current || !userLocation) return

    mapRef.current.flyTo({
      center: [userLocation.lng, userLocation.lat],
      zoom: 14,
      duration: 800, // Smooth animation
    })
  }

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
      {userLocation && !isLoading && (
        <div className="absolute right-4 top-16 z-20">
          <Button
            size="sm"
            onClick={handleCenterOnMe}
            className="shadow-lg h-10 w-10 p-0"
            variant="secondary"
            aria-label="Center on me"
          >
            <Navigation className="h-4 w-4" />
          </Button>
        </div>
      )}
      {showSearchButton && !isLoading && (
        <div className="absolute top-24 left-1/2 z-20 -translate-x-1/2">
          <Button
            size="sm"
            onClick={handleSearchArea}
            disabled={isSearching}
            className="shadow-lg px-3 py-1.5 text-xs"
          >
            {isSearching ? "Searching..." : "Search this area"}
          </Button>
        </div>
      )}
    </div>
  )
}
