import { useQuery } from "@tanstack/react-query"

interface VenueSummary {
  count: number
  singleVenueId: string | null
}

async function fetchVenueSummary(): Promise<VenueSummary> {
  const res = await fetch("/api/users/me/venues/summary")
  if (!res.ok) throw new Error("Failed to fetch venue summary")
  return res.json()
}

export function useVenueSummary(enabled = true) {
  return useQuery({
    queryKey: ["venueSummary"],
    queryFn: fetchVenueSummary,
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  })
}
