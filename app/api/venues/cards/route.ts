import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { batchGetCanonicalVenueHours, getOpenStatus } from "@/lib/hours";
import { computeAvailabilityLabel } from "@/lib/availability-utils";
import { formatDealBadgeSummary } from "@/lib/deal-utils";
import type {
  VenueCard,
  VenueCardsResponse,
  VenueDealBadge,
  VenueOpenStatus,
} from "@/types/venue";

const hoursCache = new Map<
  string,
  {
    data: Awaited<ReturnType<typeof batchGetCanonicalVenueHours>>;
    timestamp: number;
  }
>();
const HOURS_CACHE_TTL = 60 * 60 * 2 * 1000; // 2 hours

async function getCachedHours(venueIds: string[]) {
  const cacheKey = venueIds.sort().join(",");
  const cached = hoursCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < HOURS_CACHE_TTL) {
    return cached.data;
  }

  const data = await batchGetCanonicalVenueHours(venueIds);
  hoursCache.set(cacheKey, { data, timestamp: now });

  // Cleanup old cache entries
  if (hoursCache.size > 100) {
    const entries = Array.from(hoursCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    hoursCache.delete(entries[0][0]);
  }

  return data;
}

/**
 * Cards endpoint for venue listings.
 *
 * Query params:
 * - ids: Comma-separated venue IDs (fastest - use for prefetch)
 * - north, south, east, west: Map bounds
 * - q: Text search query
 * - Other filters: tags, priceMin, priceMax, seatCount, bookingMode, dealsOnly, favoritesOnly, availableNow
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);

    const idsParam = searchParams.get("ids");
    const ids = idsParam ? idsParam.split(",").filter(Boolean) : [];

    const north = searchParams.get("north");
    const south = searchParams.get("south");
    const east = searchParams.get("east");
    const west = searchParams.get("west");
    const q = searchParams.get("q")?.trim() || "";

    const tagsParam = searchParams.get("tags");
    const tags = tagsParam ? tagsParam.split(",").filter(Boolean) : [];
    const priceMin = searchParams.get("priceMin");
    const priceMax = searchParams.get("priceMax");
    const priceMinNum = priceMin ? parseFloat(priceMin) : null;
    const priceMaxNum = priceMax ? parseFloat(priceMax) : null;
    const seatCountParam = searchParams.get("seatCount");
    const seatCount = seatCountParam ? parseInt(seatCountParam, 10) : null;
    const bookingModeParam = searchParams.get("bookingMode");
    const bookingModes = bookingModeParam
      ? (bookingModeParam.split(",").filter(Boolean) as (
          | "communal"
          | "full-table"
        )[])
      : [];
    const dealsOnly = searchParams.get("dealsOnly") === "true";
    const favoritesOnly = searchParams.get("favoritesOnly") === "true";
    const availableNow = searchParams.get("availableNow") === "true";

    const hasBounds = north && south && east && west;
    let parsedBounds: {
      north: number;
      south: number;
      east: number;
      west: number;
    } | null = null;

    if (hasBounds) {
      const northNum = parseFloat(north);
      const southNum = parseFloat(south);
      const eastNum = parseFloat(east);
      const westNum = parseFloat(west);

      if (
        !isNaN(northNum) &&
        !isNaN(southNum) &&
        !isNaN(eastNum) &&
        !isNaN(westNum) &&
        northNum > southNum &&
        eastNum > westNum
      ) {
        parsedBounds = {
          north: northNum,
          south: southNum,
          east: eastNum,
          west: westNum,
        };
      } else {
        return NextResponse.json(
          { error: "Invalid map bounds provided" },
          { status: 400 },
        );
      }
    }

    const now = new Date();
    const horizonEnd = new Date(now.getTime() + 12 * 60 * 60 * 1000);

    const whereClause: Record<string, unknown> = {
      onboardingStatus: "APPROVED",
      status: { not: "DELETED" },
      pausedAt: null,
    };

    // If IDs provided, use them directly (fastest path for prefetch)
    if (ids.length > 0) {
      whereClause.id = { in: ids };
    } else if (parsedBounds && q.length === 0) {
      whereClause.latitude = {
        gte: parsedBounds.south,
        lte: parsedBounds.north,
      };
      whereClause.longitude = {
        gte: parsedBounds.west,
        lte: parsedBounds.east,
      };
    }

    if (q.length > 0) {
      whereClause.OR = [
        { name: { contains: q, mode: "insensitive" as const } },
        { address: { contains: q, mode: "insensitive" as const } },
        { city: { contains: q, mode: "insensitive" as const } },
        { neighborhood: { contains: q, mode: "insensitive" as const } },
      ];
    }

    if (tags.length > 0) {
      whereClause.tags = { hasSome: tags };
    }

    if (priceMinNum !== null && !isNaN(priceMinNum)) {
      whereClause.hourlySeatPrice = {
        ...((whereClause.hourlySeatPrice as Record<string, unknown>) || {}),
        gte: priceMinNum,
      };
    }
    if (priceMaxNum !== null && !isNaN(priceMaxNum)) {
      whereClause.hourlySeatPrice = {
        ...((whereClause.hourlySeatPrice as Record<string, unknown>) || {}),
        lte: priceMaxNum,
      };
    }

    if (dealsOnly) {
      whereClause.deals = { some: { isActive: true } };
    }

    if (favoritesOnly && session?.user?.id) {
      whereClause.favoriteVenues = { some: { userId: session.user.id } };
    } else if (favoritesOnly && !session?.user?.id) {
      return NextResponse.json({ venues: [], favoritedVenueIds: [] });
    }

    let venues = await prisma.venue.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        state: true,
        latitude: true,
        longitude: true,
        hourlySeatPrice: true,
        tags: true,
        heroImageUrl: true,
        imageUrls: true,
        tables: {
          where: { isActive: true },
          select: {
            seatCount: true,
            bookingMode: true,
            tablePricePerHour: true,
            isCommunal: true,
            seats: {
              where: { isActive: true },
              select: { pricePerHour: true },
            },
          },
        },
        deals: {
          where: { isActive: true },
          orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
          take: 1,
        },
      },
      take: 100,
      orderBy: q.length > 0 ? { name: "asc" } : { createdAt: "desc" },
    });

    const shouldApplyFilters = ids.length === 0;

    if (shouldApplyFilters && q.length > 0) {
      const queryLower = q.toLowerCase();
      venues = venues.filter((venue) => {
        const matchedByOtherFields =
          venue.name.toLowerCase().includes(queryLower) ||
          venue.address?.toLowerCase().includes(queryLower) ||
          venue.city?.toLowerCase().includes(queryLower);
        if (matchedByOtherFields) return true;
        if (Array.isArray(venue.tags) && venue.tags.length > 0) {
          return venue.tags.some((tag: string) =>
            tag.toLowerCase().includes(queryLower),
          );
        }
        return false;
      });
    }

    if (
      shouldApplyFilters &&
      seatCount !== null &&
      !isNaN(seatCount) &&
      seatCount > 0
    ) {
      venues = venues.filter((venue) => {
        const capacity = venue.tables.reduce((sum, table) => {
          if (table.seats.length > 0) return sum + table.seats.length;
          return sum + (table.seatCount || 0);
        }, 0);
        return capacity >= seatCount;
      });
    }

    if (shouldApplyFilters && bookingModes.length > 0) {
      venues = venues.filter((venue) =>
        bookingModes.some((mode) => {
          if (mode === "communal") {
            return venue.tables.some((table) => table.isCommunal === true);
          } else if (mode === "full-table") {
            return venue.tables.some((table) => table.bookingMode === "group");
          }
          return false;
        }),
      );
    }

    const venueIds = venues.map((v) => v.id);

    const [hoursMap, reservations] = await Promise.all([
      getCachedHours(venueIds),
      venueIds.length
        ? prisma.reservation.findMany({
            where: {
              venueId: { in: venueIds },
              status: { not: "cancelled" },
              startAt: { lt: horizonEnd },
              endAt: { gt: now },
            },
            select: {
              venueId: true,
              startAt: true,
              endAt: true,
              seatCount: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const reservationsByVenue = reservations.reduce<
      Record<string, { startAt: Date; endAt: Date; seatCount: number }[]>
    >((acc, res) => {
      if (!acc[res.venueId]) acc[res.venueId] = [];
      acc[res.venueId].push({
        startAt: res.startAt,
        endAt: res.endAt,
        seatCount: res.seatCount,
      });
      return acc;
    }, {});

    function roundUpToNext15Minutes(date: Date): Date {
      const result = new Date(date);
      const minutes = result.getMinutes();
      const remainder = minutes % 15;
      if (remainder !== 0) {
        result.setMinutes(minutes + (15 - remainder), 0, 0);
      } else if (result.getSeconds() > 0 || result.getMilliseconds() > 0) {
        result.setMinutes(minutes + 15, 0, 0);
      } else {
        result.setSeconds(0, 0);
      }
      return result;
    }

    type VenueWithOpenStatus = {
      venue: (typeof venues)[number];
      openStatus: ReturnType<typeof getOpenStatus> | null;
      timezone: string | null;
    };

    let venuesWithOpenStatus: VenueWithOpenStatus[] = venues.map((venue) => {
      const canonical = hoursMap.get(venue.id) ?? null;
      const openStatus = canonical ? getOpenStatus(canonical, now) : null;
      return { venue, openStatus, timezone: canonical?.timezone ?? null };
    });

    if (shouldApplyFilters && availableNow) {
      venuesWithOpenStatus = venuesWithOpenStatus.filter(
        ({ venue, openStatus }) => {
          if (!openStatus?.isOpen) return false;
          const capacity = venue.tables.reduce((sum, table) => {
            if (table.seats.length > 0) return sum + table.seats.length;
            return sum + (table.seatCount || 0);
          }, 0);
          if (capacity <= 0) return false;
          const startBase = roundUpToNext15Minutes(now);
          const windowEnd = new Date(startBase.getTime() + 60 * 60 * 1000);
          const venueReservations = reservationsByVenue[venue.id] || [];
          const bookedSeats = venueReservations.reduce((sum, res) => {
            if (res.startAt < windowEnd && res.endAt > startBase)
              return sum + res.seatCount;
            return sum;
          }, 0);
          const availableSeats = capacity - bookedSeats;
          if (seatCount !== null && !isNaN(seatCount) && seatCount > 0) {
            return availableSeats >= seatCount;
          }
          return availableSeats > 0;
        },
      );
    }

    const favoritesPromise =
      session?.user?.id && venueIds.length > 0
        ? prisma.favoriteVenue.findMany({
            where: { userId: session.user.id, venueId: { in: venueIds } },
            select: { venueId: true },
          })
        : Promise.resolve([]);

    const formattedVenues: VenueCard[] = venuesWithOpenStatus
      .filter(
        ({ venue }) => venue.latitude !== null && venue.longitude !== null,
      )
      .map(({ venue, openStatus, timezone }) => {
        const capacity = venue.tables.reduce((sum, table) => {
          if (table.seats.length > 0) return sum + table.seats.length;
          return sum + (table.seatCount || 0);
        }, 0);

        const allSeatPrices = venue.tables.flatMap((t) =>
          t.seats
            .map((s) => s.pricePerHour)
            .filter((p): p is number => p != null && p > 0),
        );
        const allTablePrices = venue.tables
          .filter(
            (t) =>
              t.bookingMode === "group" &&
              t.tablePricePerHour != null &&
              t.tablePricePerHour > 0,
          )
          .map((t) => t.tablePricePerHour as number);
        const candidatePrices = [...allSeatPrices, ...allTablePrices];
        const fallback = venue.hourlySeatPrice > 0 ? venue.hourlySeatPrice : 0;
        const minPrice =
          candidatePrices.length > 0 ? Math.min(...candidatePrices) : fallback;
        const maxPrice =
          candidatePrices.length > 0 ? Math.max(...candidatePrices) : fallback;

        const venueReservations = reservationsByVenue[venue.id] || [];
        const availabilityLabel = computeAvailabilityLabel(
          capacity,
          venueReservations,
          openStatus,
          {
            timeZone: timezone ?? undefined,
          },
        );

        let imageUrl: string | null = null;
        if (
          venue.heroImageUrl &&
          typeof venue.heroImageUrl === "string" &&
          venue.heroImageUrl.length > 0
        ) {
          imageUrl = venue.heroImageUrl;
        } else if (venue.imageUrls) {
          if (Array.isArray(venue.imageUrls) && venue.imageUrls.length > 0) {
            const first = venue.imageUrls[0];
            if (typeof first === "string" && first.length > 0) {
              imageUrl = first;
            }
          }
        }

        let dealBadge: VenueDealBadge | null = null;
        const primaryDeal = venue.deals?.[0];
        if (primaryDeal?.title) {
          dealBadge = {
            title: primaryDeal.title,
            description: primaryDeal.description || "",
            type: primaryDeal.type || "",
            summary: formatDealBadgeSummary(primaryDeal),
          };
        }

        const openStatusResult: VenueOpenStatus | null = openStatus
          ? {
              status: openStatus.status,
              todayHoursText: openStatus.todayHoursText,
            }
          : null;

        return {
          id: venue.id,
          name: venue.name,
          address: venue.address || "",
          city: venue.city ?? undefined,
          state: venue.state ?? undefined,
          latitude: venue.latitude as number,
          longitude: venue.longitude as number,
          minPrice,
          maxPrice,
          tags: venue.tags || [],
          imageUrl,
          availabilityLabel,
          openStatus: openStatusResult,
          dealBadge,
        };
      });

    const favorites = await favoritesPromise;
    const favoritedVenueIds = favorites.map((f) => f.venueId);

    const response: VenueCardsResponse = {
      venues: formattedVenues,
      favoritedVenueIds,
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching venue cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch venue cards" },
      { status: 500 },
    );
  }
}
