"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MapView } from "@/components/explore/MapView";
import { TopOverlayControls } from "@/components/explore/TopOverlayControls";
import { ExploreWelcomeBanner } from "@/components/ExploreWelcomeBanner";
import { safeSet } from "@/lib/storage";
import { VenuePreviewSheet } from "@/components/explore/VenuePreviewSheet";
import { ResultsDrawer } from "@/components/explore/ResultsDrawer";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import {
  useVenuePins,
  useVenueCards,
  useVenueCard,
  useExploreFilters,
  type InitialFilters,
  type VenuePin,
} from "@/lib/hooks";
import {
  filterStateToSearchFilters,
  hasActiveFilters,
  type ExploreVenue,
} from "@/lib/explore-utils";
import type { MapBounds, VenueCard } from "@/types/venue";

type LocationState =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "unavailable";

const LOCATION_OUTCOME_KEY = "nooc_location_last_outcome_v1";

function venueCardToExploreVenue(card: VenueCard): ExploreVenue {
  return {
    id: card.id,
    name: card.name,
    address: card.address,
    city: card.city,
    state: card.state,
    latitude: card.latitude,
    longitude: card.longitude,
    minPrice: card.minPrice,
    maxPrice: card.maxPrice,
    tags: card.tags,
    capacity: 0,
    availabilityLabel: card.availabilityLabel,
    openStatus: card.openStatus,
    imageUrls: card.imageUrl ? [card.imageUrl] : undefined,
    hourlySeatPrice: card.minPrice,
    dealBadge: card.dealBadge,
  };
}

interface ExploreClientProps {
  favoritedVenueIds?: Set<string>;
  initialFilters?: InitialFilters;
}

export function ExploreClient({
  favoritedVenueIds = new Set<string>(),
  initialFilters,
}: ExploreClientProps) {
  const queryClient = useQueryClient();
  const [isClient, setIsClient] = useState(false);

  const {
    filters,
    setFilters,
    filtersRef,
    searchQuery,
    setSearchQuery,
    activeFilterCount,
    filterChips,
    clearFilters,
  } = useExploreFilters(initialFilters);

  const [currentBounds, setCurrentBounds] = useState<MapBounds | null>(null);
  const [favoritedVenueIdsState, setFavoritedVenueIdsState] =
    useState<Set<string>>(favoritedVenueIds);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const [mapReady, setMapReady] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [venueLoadingOverlay, setVenueLoadingOverlay] = useState(false);
  const [centerOnVenueId, setCenterOnVenueId] = useState<string | null>(null);
  const [shouldFitMapBounds, setShouldFitMapBounds] = useState(false);
  const [debugBounds, setDebugBounds] = useState<MapBounds | null>(null);

  const hasReceivedInitialBoundsRef = useRef(false);
  const didAreaSearchRef = useRef(false);

  const searchFilters = useMemo(
    () => filterStateToSearchFilters(filters),
    [filters]
  );
  const hasFilters = hasActiveFilters(filters) || searchQuery.length > 0;

  // Phase 1: Fetch pins (fast, just for map dots)
  const {
    data: pinsData,
    isLoading: isPinsLoading,
    isFetching: isPinsFetching,
  } = useVenuePins(currentBounds, isClient && !hasFilters);

  const pins = pinsData?.pins ?? [];
  const pinIds = useMemo(() => pins.map((p) => p.id), [pins]);

  // Phase 2: Fetch cards using pin IDs (parallel, for drawer)
  const {
    data: cardsData,
    isLoading: isCardsLoading,
    isFetching: isCardsFetching,
  } = useVenueCards({
    ids: hasFilters ? undefined : pinIds,
    bounds: hasFilters ? currentBounds : undefined,
    searchQuery: searchQuery.length > 0 ? searchQuery : undefined,
    filters: searchFilters,
    enabled: isClient && (pinIds.length > 0 || hasFilters),
  });

  const venues: ExploreVenue[] = useMemo(() => {
    if (!cardsData?.venues) return [];
    return cardsData.venues
      .filter((v) => v.latitude != null && v.longitude != null)
      .map(venueCardToExploreVenue);
  }, [cardsData?.venues]);

  const cardsById = useMemo(() => {
    const map = new Map<string, ExploreVenue>();
    venues.forEach((v) => map.set(v.id, v));
    return map;
  }, [venues]);

  // Fetch single card when pin is clicked but card data isn't loaded yet
  const needsSingleCardFetch =
    selectedVenueId !== null && !cardsById.has(selectedVenueId);
  const {
    data: singleCardData,
    isLoading: isSingleCardLoading,
  } = useVenueCard(selectedVenueId, needsSingleCardFetch);

  const selectedVenue = useMemo(() => {
    if (!selectedVenueId) return null;
    // First try from batch-loaded cards
    const fromBatch = cardsById.get(selectedVenueId);
    if (fromBatch) return fromBatch;
    // Fall back to single-fetched card
    if (singleCardData?.venue) {
      return venueCardToExploreVenue(singleCardData.venue);
    }
    return null;
  }, [selectedVenueId, cardsById, singleCardData?.venue]);

  useEffect(() => {
    if (cardsData?.favoritedVenueIds) {
      setFavoritedVenueIdsState(
        (prev) => new Set([...prev, ...cardsData.favoritedVenueIds])
      );
    }
  }, [cardsData?.favoritedVenueIds]);

  useEffect(() => setIsClient(true), []);

  useEffect(() => {
    if (!isClient) return;
    if (
      locationState === "idle" ||
      userLocation !== null ||
      locationState === "denied" ||
      locationState === "unavailable"
    ) {
      setMapReady(true);
    }
  }, [isClient, userLocation, locationState]);

  useEffect(() => {
    if (selectedVenueId) {
      setVenueLoadingOverlay(true);
      const t = setTimeout(() => setVenueLoadingOverlay(false), 250);
      return () => clearTimeout(t);
    }
    setVenueLoadingOverlay(false);
  }, [selectedVenueId]);

  useEffect(() => {
    if (!centerOnVenueId) return;
    const t = setTimeout(() => setCenterOnVenueId(null), 800);
    return () => clearTimeout(t);
  }, [centerOnVenueId]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationState("unavailable");
      safeSet(LOCATION_OUTCOME_KEY, "unavailable");
      return;
    }
    setLocationState("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocationState("granted");
        safeSet(LOCATION_OUTCOME_KEY, "granted");
      },
      (err) => {
        console.error("Geolocation error:", err);
        setLocationState("denied");
        safeSet(LOCATION_OUTCOME_KEY, err.code === 1 ? "denied" : "error");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  const handleSearchArea = useCallback((bounds: MapBounds) => {
    setCurrentBounds(bounds);
    if (process.env.NODE_ENV !== "production") setDebugBounds(bounds);
    didAreaSearchRef.current = true;
    // Don't invalidate queries - TanStack Query handles refetch based on queryKey change
    // Setting new bounds triggers new pins query → new pinIds → new cards query
    setTimeout(() => {
      didAreaSearchRef.current = false;
    }, 2000);
  }, []);

  const handleInitialBounds = useCallback((bounds: MapBounds) => {
    if (hasReceivedInitialBoundsRef.current) return;
    hasReceivedInitialBoundsRef.current = true;
    setCurrentBounds(bounds);
    if (process.env.NODE_ENV !== "production") setDebugBounds(bounds);
  }, []);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
    },
    [setSearchQuery]
  );

  const handleApplyFilters = useCallback(
    (appliedFilters?: typeof filters) => {
      if (appliedFilters) {
        setFilters(appliedFilters);
        filtersRef.current = appliedFilters;
        setShouldFitMapBounds(true);
      }
    },
    [setFilters, filtersRef]
  );

  const handleToggleFavorite = useCallback(
    async (venueId: string, favorited: boolean) => {
      setFavoritedVenueIdsState((prev) => {
        const newSet = new Set(prev);
        favorited ? newSet.add(venueId) : newSet.delete(venueId);
        return newSet;
      });
      if (filters.favoritesOnly && !favorited) {
        await queryClient.invalidateQueries({ queryKey: ["venueCards"] });
      }
    },
    [filters.favoritesOnly, queryClient]
  );

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  // Separate loading states: pins for map, cards for drawer
  const isPinsSearching = isPinsLoading || isPinsFetching;
  const isCardsSearching = isCardsLoading || isCardsFetching;
  // Initial loading: no pins yet and still loading
  const isInitialLoad = isPinsSearching && pins.length === 0 && !hasFilters;

  return (
    <div className="fixed inset-0 flex flex-col">
      {venueLoadingOverlay && (
        <LoadingOverlay zIndex={40} className="pointer-events-none" />
      )}
      {/* Initial loading overlay */}
      {isClient && mapReady && isInitialLoad && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-background/50 backdrop-blur-[1px] pointer-events-none">
          <div className="flex items-center gap-2 rounded-full px-4 py-2">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-medium text-foreground">
              Finding venues nearby…
            </span>
          </div>
        </div>
      )}
      {isClient && !mapReady && (
        <div className="fixed inset-0 z-0 flex items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      )}
      {isClient && mapReady && (
        <>
          <MapView
            venues={pins.map((p) => {
              const card = cardsById.get(p.id);
              // Use pin's data - stable, no flicker when cards load
              return {
                id: p.id,
                name: p.name,
                address: card?.address ?? "",
                latitude: p.lat,
                longitude: p.lng,
                minPrice: p.minPrice,
                maxPrice: card?.maxPrice ?? p.minPrice,
                availabilityLabel: p.status === "OPEN_NOW" ? "Available now" : undefined,
              };
            })}
            userLocation={userLocation}
            onSelectVenue={setSelectedVenueId}
            onMapClick={() => setSelectedVenueId(null)}
            onSearchArea={handleSearchArea}
            isSearching={isPinsSearching}
            centerOnVenueId={centerOnVenueId}
            hasMapboxToken={!!mapboxToken}
            shouldFitBounds={shouldFitMapBounds}
            skipFitBounds={didAreaSearchRef.current}
            onBoundsFitted={() => setShouldFitMapBounds(false)}
            onRequestLocation={requestLocation}
            locationState={locationState}
            isSearchingArea={didAreaSearchRef.current}
            onBoundsChange={setDebugBounds}
            onInitialBounds={handleInitialBounds}
            didAreaSearch={didAreaSearchRef.current}
            initialLoadingComplete={pins.length > 0 || !isPinsLoading}
            isFetchingPins={isPinsFetching}
            isInitialLoading={isInitialLoad}
          />
          {process.env.NODE_ENV !== "production" && (
            <div className="fixed bottom-20 left-2 z-10 rounded bg-background/90 px-2 py-1 text-xs font-mono text-muted-foreground shadow">
              pins: {pins.length} | cards: {venues.length} | pins:
              {isPinsSearching ? "⏳" : "✓"} cards:
              {isCardsSearching ? "⏳" : "✓"}
            </div>
          )}
          <div className="fixed left-0 right-0 top-0 z-10 flex flex-col gap-2">
            <ExploreWelcomeBanner
              onUseLocation={requestLocation}
              locationState={locationState}
            />
            <TopOverlayControls
              onSearch={handleSearch}
              filterPanelOpen={filterPanelOpen}
              onFilterPanelOpenChange={setFilterPanelOpen}
              filters={filters}
              onFiltersChange={setFilters}
              onApplyFilters={handleApplyFilters}
              onClearFilters={clearFilters}
              activeFilterCount={activeFilterCount}
            />
            {filterChips.length > 0 && (
              <div className="mx-4 flex flex-wrap gap-2">
                {filterChips.map((chip) => (
                  <div
                    key={chip.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/95 backdrop-blur-sm px-3 py-1.5 text-xs font-medium shadow-sm"
                  >
                    <span className="text-foreground">{chip.label}</span>
                    <button
                      type="button"
                      onClick={chip.onRemove}
                      className="ml-0.5 rounded-full hover:bg-muted p-0.5 transition-colors"
                      aria-label={`Remove ${chip.label} filter`}
                    >
                      <svg
                        className="h-3 w-3 text-muted-foreground"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <ResultsDrawer
            venues={venues}
            isLoading={isCardsSearching}
            isInitialLoading={isInitialLoad}
            onSelectVenue={setSelectedVenueId}
            onCenterOnVenue={setCenterOnVenueId}
            autoExpand={searchQuery.length > 0}
            favoritesOnly={filters.favoritesOnly}
            favoritedVenueIds={favoritedVenueIdsState}
            onToggleFavorite={handleToggleFavorite}
            onClearFavoritesFilter={() =>
              setFilters({ ...filters, favoritesOnly: false })
            }
            // In search/filter mode, use venues.length; in browse mode, use pins total
            total={hasFilters ? venues.length : (pinsData?.total ?? 0)}
            isSearchMode={hasFilters}
            searchQuery={searchQuery}
          />
          <VenuePreviewSheet
            open={!!selectedVenueId}
            venue={selectedVenue}
            isLoading={needsSingleCardFetch && isSingleCardLoading}
            initialSeatCount={
              filters.seatCount && filters.seatCount > 0
                ? filters.seatCount
                : undefined
            }
            isFavorited={
              selectedVenue
                ? favoritedVenueIdsState.has(selectedVenue.id)
                : false
            }
            onToggleFavorite={() =>
              selectedVenue &&
              handleToggleFavorite(
                selectedVenue.id,
                !favoritedVenueIdsState.has(selectedVenue.id)
              )
            }
            onClose={() => setSelectedVenueId(null)}
          />
        </>
      )}
    </div>
  );
}
