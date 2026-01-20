"use client"

import { useEffect, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"

interface Venue {
  id: string
  name: string
  address: string
  latitude: number | null
  longitude: number | null
  hourlySeatPrice: number
}

interface MapboxMapProps {
  venues: Venue[]
}

// NYC coordinates (default center)
const NYC_CENTER = { lat: 40.7128, lng: -74.006 }

export function MapboxMap({ venues }: MapboxMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mapError, setMapError] = useState<string | null>(null)

  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN

  // Debug: Log component mount
  useEffect(() => {
    console.log("🗺️ MapboxMap component mounted", {
      hasToken: !!accessToken,
      tokenPreview: accessToken ? `${accessToken.substring(0, 10)}...` : "MISSING",
      venuesCount: venues.length,
      hasContainer: !!mapContainerRef.current,
    })
  }, [])

  useEffect(() => {
    if (!accessToken || accessToken === "your_mapbox_token_here") {
      console.error("❌ Mapbox access token not configured", {
        hasToken: !!accessToken,
        tokenValue: accessToken,
      })
      setMapError("Mapbox access token not configured. Please add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to your .env file with a valid Mapbox token.")
      setIsLoading(false)
      return
    }

    if (!mapContainerRef.current || mapRef.current) {
      console.log("⏭️ Skipping initialization", {
        hasContainer: !!mapContainerRef.current,
        hasMap: !!mapRef.current,
      })
      return
    }

    console.log("🚀 Initializing Mapbox map...", {
      hasContainer: !!mapContainerRef.current,
      containerElement: mapContainerRef.current,
    })

    mapboxgl.accessToken = accessToken

    // Determine center
    let center: [number, number] = [NYC_CENTER.lng, NYC_CENTER.lat]
    const validVenues = venues.filter(
      (v) => v.latitude !== null && v.longitude !== null
    )
    if (validVenues.length > 0) {
      center = [validVenues[0].longitude!, validVenues[0].latitude!]
    }

    try {
      console.log("🗺️ Creating Mapbox map instance...", { center, zoom: validVenues.length > 0 ? 12 : 10 })
      
      // Create map with branded, minimal style
      const map = new mapboxgl.Map({
        container: mapContainerRef.current!,
        style: "mapbox://styles/mapbox/light-v11", // Light, minimal style
        center,
        zoom: validVenues.length > 0 ? 12 : 10,
        attributionControl: false, // We'll add custom attribution
      })
      
      console.log("✅ Map instance created, waiting for load event...")

      // Add custom attribution (minimal)
      map.addControl(new mapboxgl.AttributionControl({
        compact: true,
        customAttribution: '© Nook'
      }))

      // Add navigation controls (zoom)
      map.addControl(new mapboxgl.NavigationControl({
        showCompass: false,
        showZoom: true,
      }))

      // Set up a timeout in case load event never fires
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current)
      }
      loadTimeoutRef.current = setTimeout(() => {
        console.error("⏰ Map load timeout - load event didn't fire after 10 seconds")
        setMapError("Map took too long to load. Please check your Mapbox token and network connection.")
        setIsLoading(false)
      }, 10000) // 10 second timeout

      // Wait for map to load
      map.on("load", () => {
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current)
          loadTimeoutRef.current = null
        }
        console.log("✅ Mapbox map loaded successfully")
        
        try {
          // Style street labels with branded, minimal aesthetic
          const layers = map.getStyle().layers
          console.log("📝 Styling labels from", layers.length, "layers")
          
          layers.forEach((layer) => {
            // Style road labels (street names) - keep them visible but branded
            if (layer.type === "symbol" && layer.id.includes("road") && layer.id.includes("label")) {
              try {
                map.setLayoutProperty(layer.id, "visibility", "visible")
                // Style with warm, readable colors
                map.setPaintProperty(layer.id, "text-color", "#5c6b66") // Warm gray-green
                map.setPaintProperty(layer.id, "text-halo-color", "#ffffff")
                map.setPaintProperty(layer.id, "text-halo-width", 1.5)
                map.setPaintProperty(layer.id, "text-halo-blur", 1)
              } catch (e) {
                // Layer might not support this property
              }
            }
            
            // Hide POI labels (business names, etc.) - keep it minimal
            if (layer.type === "symbol" && (
              layer.id.includes("poi") || 
              layer.id.includes("place") && !layer.id.includes("road")
            )) {
              try {
                map.setLayoutProperty(layer.id, "visibility", "none")
              } catch (e) {
                // Layer might not exist
              }
            }
          })

          // Apply custom colors for warm, minimal aesthetic
          try {
            // Style water with calm tone
            if (map.getLayer("water")) {
              map.setPaintProperty("water", "fill-color", "#e8f5e9")
            }
            
            // Style roads with warm neutrals
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

          // Add markers
          addMarkers(map)

          setIsLoading(false)
          console.log("✅ Map initialization complete")
        } catch (error) {
          console.error("❌ Error styling map:", error)
          setIsLoading(false)
        }
      })

      map.on("error", (e: any) => {
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current)
          loadTimeoutRef.current = null
        }
        console.error("❌ Mapbox error:", e)
        console.error("❌ Error details:", e.error)
        console.error("❌ Error type:", e.type)
        setMapError(`Failed to load map: ${e.error?.message || e.message || "Unknown error"}`)
        setIsLoading(false)
      })

      map.on("style.load", () => {
        console.log("🎨 Map style loaded")
      })

      map.on("style.error", (e: any) => {
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current)
          loadTimeoutRef.current = null
        }
        console.error("❌ Map style error:", e)
        console.error("❌ Style error details:", e.error)
        setMapError(`Failed to load map style: ${e.error?.message || "Unknown error"}. Check your Mapbox token.`)
        setIsLoading(false)
      })

      // Listen for data event (fires when map data is loaded)
      map.on("data", (e: any) => {
        console.log("📊 Map data event:", e.dataType)
        if (e.dataType === "style") {
          console.log("📊 Style data loaded")
        }
      })

      // Also listen for idle event as backup
      map.on("idle", () => {
        console.log("✅ Map idle (all tiles loaded)")
        // If we're still loading and load event hasn't fired, try to initialize anyway
        if (isLoading && map.loaded() && map.getStyle()) {
          console.log("✅ Map is ready (idle event), initializing...")
          if (loadTimeoutRef.current) {
            clearTimeout(loadTimeoutRef.current)
            loadTimeoutRef.current = null
          }
          try {
            const layers = map.getStyle().layers
            
            // Style street labels
            layers.forEach((layer) => {
              // Style road labels (street names)
              if (layer.type === "symbol" && layer.id.includes("road") && layer.id.includes("label")) {
                try {
                  map.setLayoutProperty(layer.id, "visibility", "visible")
                  map.setPaintProperty(layer.id, "text-color", "#5c6b66")
                  map.setPaintProperty(layer.id, "text-halo-color", "#ffffff")
                  map.setPaintProperty(layer.id, "text-halo-width", 1.5)
                  map.setPaintProperty(layer.id, "text-halo-blur", 1)
                } catch (e) {}
              }
              
              // Hide POI and place labels (except roads)
              if (layer.type === "symbol" && (
                layer.id.includes("poi") || 
                (layer.id.includes("place") && !layer.id.includes("road"))
              )) {
                try {
                  map.setLayoutProperty(layer.id, "visibility", "none")
                } catch (e) {}
              }
            })
            
            addMarkers(map)
            setIsLoading(false)
            console.log("✅ Map initialized via idle event")
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
        // Cleanup markers
        markersRef.current.forEach((marker) => marker.remove())
        markersRef.current = []
        if (mapRef.current) {
          mapRef.current.remove()
          mapRef.current = null
        }
      }
    } catch (error) {
      console.error("Error initializing Mapbox:", error)
      setMapError("Failed to initialize map")
      setIsLoading(false)
    }
  }, [accessToken])

  // Update markers when venues change
  useEffect(() => {
    if (mapRef.current && !isLoading) {
      // Clear existing markers
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      addMarkers(mapRef.current)
    }
  }, [venues])

  const addMarkers = (map: mapboxgl.Map) => {
    // Create custom branded marker element
    const createMarkerElement = (venue: Venue) => {
      const el = document.createElement("div")
      el.className = "custom-marker"
      el.style.width = "24px"
      el.style.height = "24px"
      el.style.borderRadius = "50% 50% 50% 0"
      el.style.backgroundColor = "#0F5132" // Dark green primary
      el.style.border = "2px solid #ffffff"
      el.style.transform = "rotate(-45deg)"
      el.style.cursor = "pointer"
      el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)"
      
      // Inner circle
      const inner = document.createElement("div")
      inner.style.width = "10px"
      inner.style.height = "10px"
      inner.style.borderRadius = "50%"
      inner.style.backgroundColor = "#ffffff"
      inner.style.position = "absolute"
      inner.style.top = "50%"
      inner.style.left = "50%"
      inner.style.transform = "translate(-50%, -50%) rotate(45deg)"
      el.appendChild(inner)

      return el
    }

    venues.forEach((venue) => {
      if (venue.latitude === null || venue.longitude === null) return

      const el = createMarkerElement(venue)

      // Create popup
      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: true,
        closeOnClick: false,
        className: "mapbox-popup",
      }).setHTML(`
        <div style="
          padding: 16px; 
          min-width: 220px; 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', system-ui, sans-serif;
        ">
          <h3 style="
            margin: 0 0 10px 0; 
            font-size: 18px; 
            font-weight: 600; 
            color: #1f2937;
            letter-spacing: -0.01em;
          ">
            ${venue.name}
          </h3>
          <p style="
            margin: 0 0 12px 0; 
            font-size: 15px; 
            color: #4b5563;
            font-weight: 500;
          ">
            $${venue.hourlySeatPrice.toFixed(2)} <span style="font-weight: 400; font-size: 13px; color: #6b7280;">/ seat / hour</span>
          </p>
          <a 
            href="/venue/${venue.id}" 
            style="
              display: inline-block; 
              padding: 8px 16px; 
              background: #0F5132; 
              color: white; 
              text-decoration: none; 
              border-radius: 6px; 
              font-size: 14px; 
              font-weight: 500;
            "
          >
            View Details
          </a>
        </div>
      `)

      // Create marker
      const marker = new mapboxgl.Marker(el)
        .setLngLat([venue.longitude, venue.latitude])
        .setPopup(popup)
        .addTo(map)

      markersRef.current.push(marker)
    })

    // Fit bounds to show all venues
    if (venues.length > 1) {
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
      }
    } else if (venues.length === 1 && venues[0].latitude !== null && venues[0].longitude !== null) {
      map.setCenter([venues[0].longitude, venues[0].latitude])
      map.setZoom(14)
    }
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
    <div className="relative h-full w-full">
      <div 
        ref={mapContainerRef} 
        className="h-full w-full"
        style={{ minHeight: "400px" }}
      />
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/50">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  )
}