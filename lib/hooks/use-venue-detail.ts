import { useQuery } from "@tanstack/react-query"
import type { VenueDetail } from "@/types/venue"

interface UseVenueDetailOptions {
  venueId: string | null
  enabled?: boolean
}

async function fetchVenueDetail(venueId: string): Promise<VenueDetail | null> {
  const response = await fetch(`/api/venues/${venueId}`)
  if (!response.ok) {
    if (response.status === 404) {
      return null
    }
    throw new Error("Failed to fetch venue detail")
  }

  return response.json()
}

export function useVenueDetail(options: UseVenueDetailOptions) {
  const { venueId, enabled = true } = options

  return useQuery({
    queryKey: ["venueDetail", venueId],
    queryFn: () => fetchVenueDetail(venueId!),
    enabled: enabled && venueId !== null,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}
