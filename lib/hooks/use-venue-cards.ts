import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  VenueCard,
  VenueCardsResponse,
  MapBounds,
  VenueSearchFilters,
} from "@/types/venue";

interface UseVenueCardsOptions {
  ids?: string[];
  bounds?: MapBounds | null;
  searchQuery?: string;
  filters?: VenueSearchFilters;
  enabled?: boolean;
}

interface VenueCardsResult {
  venues: VenueCard[];
  favoritedVenueIds: string[];
}

async function fetchVenueCards(
  options: UseVenueCardsOptions,
): Promise<VenueCardsResult> {
  const { ids, bounds, searchQuery, filters } = options;
  const params = new URLSearchParams();

  if (ids && ids.length > 0) {
    params.append("ids", ids.join(","));
  } else if (bounds) {
    params.append("north", bounds.north.toString());
    params.append("south", bounds.south.toString());
    params.append("east", bounds.east.toString());
    params.append("west", bounds.west.toString());
  }

  if (searchQuery && searchQuery.length > 0) {
    params.append("q", searchQuery);
  }

  if (filters?.tags && filters.tags.length > 0) {
    params.append("tags", filters.tags.join(","));
  }
  if (filters?.priceMin != null) {
    params.append("priceMin", filters.priceMin.toString());
  }
  if (filters?.priceMax != null) {
    params.append("priceMax", filters.priceMax.toString());
  }
  if (filters?.seatCount != null) {
    params.append("seatCount", filters.seatCount.toString());
  }
  if (filters?.bookingMode && filters.bookingMode.length > 0) {
    params.append("bookingMode", filters.bookingMode.join(","));
  }
  if (filters?.dealsOnly) {
    params.append("dealsOnly", "true");
  }
  if (filters?.favoritesOnly) {
    params.append("favoritesOnly", "true");
  }
  if (filters?.availableNow) {
    params.append("availableNow", "true");
  }

  const res = await fetch(`/api/venues/cards?${params}`);
  if (!res.ok) throw new Error("Failed to fetch venue cards");

  const data: VenueCardsResponse = await res.json();
  return { venues: data.venues, favoritedVenueIds: data.favoritedVenueIds };
}

export function useVenueCards(options: UseVenueCardsOptions) {
  const { ids, bounds, searchQuery, filters, enabled = true } = options;
  const queryClient = useQueryClient();

  // Sort IDs for stable cache key (same IDs in different order = same key)
  const sortedIds = ids?.length ? [...ids].sort().join(",") : null;

  // Key based on IDs or bounds
  const queryKey = sortedIds
    ? ["venueCards", "byIds", sortedIds]
    : [
        "venueCards",
        "byBounds",
        bounds?.north,
        bounds?.south,
        bounds?.east,
        bounds?.west,
        searchQuery,
        filters?.tags?.join(","),
        filters?.priceMin,
        filters?.priceMax,
        filters?.seatCount,
        filters?.bookingMode?.join(","),
        filters?.dealsOnly,
        filters?.favoritesOnly,
        filters?.availableNow,
      ];

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (ids && ids.length > 0) {
        const cachedCards: VenueCard[] = [];
        const missingIds: string[] = [];

        for (const id of ids) {
          const cached = queryClient.getQueryData<{ venue: VenueCard }>([
            "venueCard",
            id,
          ]);
          if (cached?.venue) {
            cachedCards.push(cached.venue);
          } else {
            missingIds.push(id);
          }
        }

        if (missingIds.length === 0 && cachedCards.length === ids.length) {
          return { venues: cachedCards, favoritedVenueIds: [] };
        }

        if (missingIds.length > 0 && missingIds.length < ids.length) {
          const result = await fetchVenueCards({ ...options, ids: missingIds });

          result.venues.forEach((card) => {
            queryClient.setQueryData(["venueCard", card.id], { venue: card });
          });

          return {
            venues: [...cachedCards, ...result.venues],
            favoritedVenueIds: result.favoritedVenueIds,
          };
        }
      }

      const result = await fetchVenueCards(options);

      result.venues.forEach((card) => {
        queryClient.setQueryData(["venueCard", card.id], { venue: card });
      });

      return result;
    },
    enabled,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
