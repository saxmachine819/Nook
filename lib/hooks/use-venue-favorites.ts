import { useQuery } from "@tanstack/react-query";

interface VenueFavorites {
  venue: boolean;
  tables: string[];
  seats: string[];
}

export function useVenueFavorites(venueId: string | null, enabled = true) {
  return useQuery<VenueFavorites>({
    queryKey: ["venueFavorites", venueId],
    queryFn: async () => {
      const response = await fetch(`/api/venues/${venueId}/favorites`);
      if (!response.ok) {
        throw new Error("Failed to fetch favorites");
      }
      return response.json();
    },
    enabled: !!venueId && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
