import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isSearchLandingEnabled } from "@/lib/site-settings";
import { ExploreClient } from "./ExploreClient";

interface ExplorePageProps {
  searchParams: Promise<{
    q?: string;
    dealsOnly?: string;
    favoritesOnly?: string;
    tags?: string;
    priceMin?: string;
    priceMax?: string;
    seatCount?: string;
    bookingMode?: string;
    availableNow?: string;
    view?: string;
    from?: string;
  }>;
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const session = await auth();
  const params = await searchParams;

  // Feature flag: redirect to search landing page if enabled
  // Allow ?view=map to bypass the flag (used by "View on map" links)
  if (params?.view !== "map") {
    const searchEnabled = await isSearchLandingEnabled();
    if (searchEnabled) {
      redirect("/search");
    }
  }

  let favoritedVenueIds = new Set<string>();

  if (session?.user?.id) {
    try {
      const favorites = await prisma.favoriteVenue.findMany({
        where: { userId: session.user.id },
        select: { venueId: true },
        take: 500,
      });
      favoritedVenueIds = new Set(favorites.map((f) => f.venueId));
    } catch (error) {
      console.error("Error fetching favorites:", error);
    }
  }

  const tagsParam = params?.tags;
  const bookingModeParam = params?.bookingMode;

  const initialFilters = {
    searchQuery: params?.q?.trim() || "",
    filters: {
      tags: tagsParam ? tagsParam.split(",").filter(Boolean) : [],
      priceMin: params?.priceMin ? parseFloat(params.priceMin) : null,
      priceMax: params?.priceMax ? parseFloat(params.priceMax) : null,
      availableNow: params?.availableNow === "true",
      seatCount: params?.seatCount ? parseInt(params.seatCount, 10) : null,
      bookingMode: bookingModeParam
        ? (bookingModeParam.split(",").filter(Boolean) as (
            | "communal"
            | "full-table"
          )[])
        : [],
      dealsOnly: params?.dealsOnly === "true",
      favoritesOnly: params?.favoritesOnly === "true",
    },
  };

  const hasUrlFilters =
    initialFilters.searchQuery.length > 0 ||
    initialFilters.filters.tags.length > 0 ||
    initialFilters.filters.priceMin !== null ||
    initialFilters.filters.priceMax !== null ||
    initialFilters.filters.availableNow ||
    initialFilters.filters.seatCount !== null ||
    initialFilters.filters.bookingMode.length > 0 ||
    initialFilters.filters.dealsOnly ||
    initialFilters.filters.favoritesOnly;

  const showBackToSearch = params?.view === "map" && params?.from === "search"

  return (
    <ExploreClient
      favoritedVenueIds={favoritedVenueIds}
      initialFilters={hasUrlFilters ? initialFilters : undefined}
      showBackToSearch={showBackToSearch}
    />
  );
}
