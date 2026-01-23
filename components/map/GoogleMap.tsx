"use client"

import { useEffect, useRef, useState } from "react"

interface Venue {
  id: string
  name: string
  address: string
  latitude: number | null
  longitude: number | null
  hourlySeatPrice: number
}

interface GoogleMapProps {
  venues: Venue[]
}

declare global {
  interface Window {
    google: any
  }
}

// NYC coordinates (default center)
const NYC_CENTER = { lat: 40.7128, lng: -74.006 }

export function GoogleMap({ venues }: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mapError, setMapError] = useState<string | null>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const infoWindowsRef = useRef<any[]>([])
  const scriptLoadedRef = useRef(false)

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  // Debug: Log component mount
  useEffect(() => {
    console.error("🗺️ GOOGLE MAP COMPONENT MOUNTED", { 
      hasApiKey: !!apiKey, 
      apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : "MISSING",
      venuesCount: venues.length,
      hasMapRef: !!mapRef.current 
    })
  }, [])

  // Load Google Maps script
  useEffect(() => {
    console.error("📜 SCRIPT USEEFFECT RUNNING", { hasApiKey: !!apiKey, scriptLoaded: scriptLoadedRef.current })

    if (!apiKey) {
      console.error("❌ Google Maps API key not found")
      setMapError("Google Maps API key not found")
      setIsLoading(false)
      return
    }

    // If Google Maps is already loaded, initialize after a short delay to ensure ref is attached
    if (window.google?.maps && window.google.maps.Map) {
      console.log("✅ Google Maps already loaded, initializing...")
      scriptLoadedRef.current = true
      // Wait a bit for React to attach the ref
      setTimeout(() => {
        initializeMap()
      }, 100)
      return
    }

    // Check if script tag already exists
    const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`)
    if (existingScript) {
      console.log("📜 Script tag exists, waiting for load...")
      if (window.google?.maps) {
        scriptLoadedRef.current = true
        // Wait a bit for React to attach the ref
        setTimeout(() => {
          initializeMap()
        }, 100)
      } else {
        // Wait for script to load
        existingScript.addEventListener("load", () => {
          console.log("✅ Existing script loaded")
          scriptLoadedRef.current = true
          // Wait a bit for React to attach the ref
          setTimeout(() => {
            initializeMap()
          }, 100)
        })
      }
      return
    }

    // Create and load script
    console.log("📥 Creating new script tag...")
    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.defer = true
    
    script.onload = () => {
      console.log("✅ Google Maps script loaded successfully")
      scriptLoadedRef.current = true
      // Wait a bit for React to attach the ref
      setTimeout(() => {
        initializeMap()
      }, 100)
    }
    
    script.onerror = (error) => {
      console.error("❌ Failed to load Google Maps script:", error)
      setMapError("Failed to load Google Maps. Check your API key.")
      setIsLoading(false)
    }
    
    document.head.appendChild(script)
    console.log("📝 Script tag added to head")

    // Cleanup
    return () => {
      console.log("🧹 Cleaning up map component")
    }
  }, [apiKey])

  // Update markers when venues change
  useEffect(() => {
    if (mapInstanceRef.current && scriptLoadedRef.current) {
      console.log("🔄 Venues changed, updating markers...", venues.length)
      addMarkersToMap(mapInstanceRef.current)
    }
  }, [venues])

  const addMarkersToMap = (map: any) => {
    // Clear existing markers
    markersRef.current.forEach((marker) => {
      if (marker) marker.setMap(null)
    })
    infoWindowsRef.current.forEach((iw) => {
      if (iw) iw.close()
    })
    markersRef.current = []
    infoWindowsRef.current = []

    // Add markers for each venue
    venues.forEach((venue) => {
      if (venue.latitude === null || venue.longitude === null) {
        console.log("⏭️ Skipping venue without coordinates:", venue.name)
        return
      }

      console.log("📍 Adding marker for:", venue.name, { lat: venue.latitude, lng: venue.longitude })

      // Create custom branded marker icon (dark green pin)
      const markerIcon = {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: "#0F5132", // Dark green primary
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
        scale: 10,
      }

      // Alternative: Use a more pin-like shape
      const pinIcon = {
        path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
        fillColor: "#0F5132", // Dark green primary
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
        scale: 1.2,
        anchor: new window.google.maps.Point(12, 22),
      }

      const marker = new window.google.maps.Marker({
        position: { lat: venue.latitude, lng: venue.longitude },
        map,
        title: venue.name,
        icon: pinIcon,
        optimized: false, // Better for custom icons
      })

      // Create branded info window with calm, premium styling
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="
            padding: 16px; 
            min-width: 220px; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', system-ui, sans-serif;
            background: #ffffff;
            border-radius: 8px;
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
                transition: background-color 0.2s;
              "
              onmouseover="this.style.background='#0a4028'"
              onmouseout="this.style.background='#0F5132'"
            >
              View Details
            </a>
          </div>
        `,
      })

      // Open info window on marker click
      marker.addListener("click", () => {
        infoWindowsRef.current.forEach((iw) => {
          if (iw) iw.close()
        })
        infoWindow.open(map, marker)
      })

      markersRef.current.push(marker)
      infoWindowsRef.current.push(infoWindow)
    })

    // Adjust map bounds
    if (venues.length > 1) {
      const bounds = new window.google.maps.LatLngBounds()
      venues.forEach((venue) => {
        if (venue.latitude !== null && venue.longitude !== null) {
          bounds.extend({ lat: venue.latitude, lng: venue.longitude })
        }
      })
      if (bounds.isEmpty() === false) {
        map.fitBounds(bounds)
        const listener = window.google.maps.event.addListener(
          map,
          "bounds_changed",
          function () {
            if (map.getZoom() && map.getZoom() > 16) {
              map.setZoom(16)
            }
            window.google.maps.event.removeListener(listener)
          }
        )
      }
    } else if (venues.length === 1 && venues[0].latitude !== null && venues[0].longitude !== null) {
      map.setCenter({
        lat: venues[0].latitude,
        lng: venues[0].longitude,
      })
      map.setZoom(14)
    }
  }

  const initializeMap = () => {
    console.log("🗺️ initializeMap called", { 
      hasRef: !!mapRef.current, 
      hasGoogle: !!window.google?.maps 
    })

    if (!window.google?.maps) {
      console.error("❌ Google Maps API not loaded")
      return
    }

    // Wait for ref to be available (in case it's not attached yet)
    if (!mapRef.current) {
      console.log("⏳ Map ref not available yet, waiting...")
      // Try again after a short delay
      setTimeout(() => {
        if (mapRef.current) {
          console.log("✅ Map ref now available, initializing...")
          initializeMap()
        } else {
          console.error("❌ Map ref still not available after wait")
        }
      }, 100)
      return
    }

    try {
      // Determine center
      let center = NYC_CENTER
      const validVenues = venues.filter(
        (v) => v.latitude !== null && v.longitude !== null
      )
      if (validVenues.length > 0) {
        center = {
          lat: validVenues[0].latitude!,
          lng: validVenues[0].longitude!,
        }
        console.log("📍 Centering on venue:", center)
      } else {
        console.log("📍 Centering on NYC (default)")
      }

      console.log("🗺️ Creating map instance...")
      const map = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: validVenues.length > 0 ? 12 : 10,
        styles: [
          // Hide all text labels for minimal, clean look
          {
            featureType: "all",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
          // Hide POI (points of interest)
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
          {
            featureType: "poi",
            elementType: "geometry",
            stylers: [{ visibility: "off" }],
          },
          // Style water with warm, calm tone
          {
            featureType: "water",
            elementType: "geometry",
            stylers: [{ color: "#e8f5e9" }],
          },
          // Style roads with warm neutrals
          {
            featureType: "road",
            elementType: "geometry",
            stylers: [{ color: "#faf9f7" }],
          },
          {
            featureType: "road.highway",
            elementType: "geometry",
            stylers: [{ color: "#f5f3f0" }],
          },
          // Soften landscape
          {
            featureType: "landscape",
            elementType: "geometry",
            stylers: [{ color: "#faf9f7" }],
          },
          // Style administrative boundaries minimally
          {
            featureType: "administrative",
            elementType: "geometry",
            stylers: [{ visibility: "off" }],
          },
          {
            featureType: "administrative",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
        ],
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: false,
      })

      mapInstanceRef.current = map
      console.log("✅ Map instance created")

      // Add markers
      addMarkersToMap(map)

      setIsLoading(false)
      console.log("✅ Map initialization complete")
    } catch (error) {
      console.error("❌ Error initializing map:", error)
      setMapError("Failed to initialize map")
      setIsLoading(false)
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
      {/* Always render the map div so ref can attach */}
      <div ref={mapRef} className="h-full w-full" />
      {/* Show loading overlay while initializing */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  )
}