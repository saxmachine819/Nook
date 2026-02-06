import { useQuery, keepPreviousData } from "@tanstack/react-query"
import type { MapBounds, OpenStatusValue } from "@/types/venue"

export interface VenuePin {
  id: string
  name: string
  minPrice: number
  lat: number
  lng: number
  status: OpenStatusValue | null
}

interface PinsResponse {
  pins: VenuePin[]
  total: number
}

async function fetchPins(bounds: MapBounds): Promise<PinsResponse> {
  const params = new URLSearchParams({
    north: bounds.north.toString(),
    south: bounds.south.toString(),
    east: bounds.east.toString(),
    west: bounds.west.toString(),
  })

  const res = await fetch(`/api/venues/pins?${params}`)
  if (!res.ok) throw new Error("Failed to fetch pins")
  return res.json()
}

export function useVenuePins(bounds: MapBounds | null, enabled = true) {
  return useQuery({
    queryKey: ["venuePins", bounds?.north, bounds?.south, bounds?.east, bounds?.west],
    queryFn: () => fetchPins(bounds!),
    enabled: enabled && bounds !== null,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })
}
