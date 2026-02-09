import { useEffect, useRef, useState } from "react";
import type { VenuePin } from "./use-venue-pins";
import type { VenueCard } from "@/types/venue";

interface UseSearchNavigationOptions {
  hasFilters: boolean;
  cardsData?: { venues: VenueCard[] };
  isCardsLoading: boolean;
  useBoundedSearch: boolean;
}

export function useSearchNavigation(options: UseSearchNavigationOptions) {
  const { hasFilters, cardsData, isCardsLoading, useBoundedSearch } = options;

  const [manualPins, setManualPins] = useState<VenuePin[] | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<{ lat: number; lng: number; id: string; timestamp: number } | null>(null);
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    if (hasFilters && cardsData?.venues && !isCardsLoading) {
      const convertedPins: VenuePin[] = cardsData.venues
        .filter((v) => v.latitude != null && v.longitude != null)
        .map((v) => ({
          id: v.id,
          name: v.name,
          lat: v.latitude!,
          lng: v.longitude!,
          minPrice: v.minPrice,
          status: v.openStatus || null,
        }));

      setManualPins(convertedPins);

      if (convertedPins.length > 0 && !useBoundedSearch && !hasNavigatedRef.current) {
        const firstResult = convertedPins[0];
        setNavigationTarget({
          lat: firstResult.lat,
          lng: firstResult.lng,
          id: firstResult.id,
          timestamp: Date.now(),
        });
        hasNavigatedRef.current = true;
      }
    } else if (!hasFilters) {
      setManualPins(null);
      hasNavigatedRef.current = false;
      setNavigationTarget(null);
    }
  }, [hasFilters, cardsData?.venues, isCardsLoading, useBoundedSearch]);

  const resetNavigation = () => {
    hasNavigatedRef.current = false;
    setNavigationTarget(null);
  };

  return {
    manualPins,
    navigationTarget,
    resetNavigation,
  };
}
