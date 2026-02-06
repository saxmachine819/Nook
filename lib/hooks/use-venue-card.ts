import { useQuery } from "@tanstack/react-query"
import type { VenueCard } from "@/types/venue"

interface VenueCardResult {
  venue: VenueCard | null
}

async function fetchVenueCard(id: string): Promise<VenueCardResult> {
  const res = await fetch(`/api/venues/cards?ids=${id}`)
  if (!res.ok) throw new Error("Failed to fetch venue card")

  const data = await res.json()
  return { venue: data.venues?.[0] ?? null }
}

export function useVenueCard(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ["venueCard", id],
    queryFn: () => fetchVenueCard(id!),
    enabled: enabled && id !== null,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}
