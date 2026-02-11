import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMockPrisma } from "../setup/mocks";
import {
  createTestVenue,
  createTestTable,
  createTestSeat,
  createTestVenueHours,
} from "../helpers/test-utils";
import { cache } from "@/lib/cache";

// Mock Prisma before importing the route
const mockPrisma = createMockPrisma();
vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

// Mock fetch for DEBUG_LOG
global.fetch = vi.fn().mockResolvedValue({ ok: true });

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

// Mock hours engine
vi.mock("@/lib/hours", () => ({
  batchGetCanonicalVenueHours: vi.fn(),
  getOpenStatus: vi.fn(),
}));

// Import route and hours after mocks are set up
const { GET } = await import("@/app/api/venues/search/route");
const { batchGetCanonicalVenueHours, getOpenStatus } = await import(
  "@/lib/hours"
);

describe("GET /api/venues/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache.clearAll();
    vi.mocked(mockPrisma.venue.findMany).mockResolvedValue([]);
    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([]);
    vi.mocked(batchGetCanonicalVenueHours).mockResolvedValue(new Map());
    vi.mocked(getOpenStatus).mockReturnValue({
      isOpen: true,
      status: "AVAILABLE_NOW",
      todayHoursText: "9 AM - 5 PM",
      nextOpenAt: null,
    } as any);
  });

  describe("parameter validation", () => {
    it("returns 400 for incomplete map bounds", async () => {
      const request = new Request(
        "http://localhost/api/venues/search?north=10&south=5",
      );
      const response = await GET(request);
      expect(response.status).toBe(400);
    });

    it("returns 400 for invalid map bounds (north < south)", async () => {
      const request = new Request(
        "http://localhost/api/venues/search?north=5&south=10&east=10&west=5",
      );
      const response = await GET(request);
      expect(response.status).toBe(400);
    });
  });

  describe("filtering and results", () => {
    it("returns venues within map bounds", async () => {
      const mockVenues = [
        createTestVenue({
          id: "v1",
          latitude: 7,
          longitude: 7,
          tables: [
            {
              isActive: true,
              seatCount: 2,
              seats: [],
              bookingMode: "individual",
            },
          ],
          deals: [],
          venueHours: [],
          tags: ["test"],
          imageUrls: [],
        }),
        createTestVenue({
          id: "v2",
          latitude: 8,
          longitude: 8,
          tables: [],
          deals: [],
          venueHours: [],
          tags: [],
          imageUrls: [],
        }),
      ];
      vi.mocked(mockPrisma.venue.findMany).mockResolvedValue(mockVenues as any);

      const request = new Request(
        "http://localhost/api/venues/search?north=10&south=5&east=10&west=5",
      );
      const response = await GET(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.venues).toHaveLength(2);
      expect(mockPrisma.venue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            latitude: { gte: 5, lte: 10 },
            longitude: { gte: 5, lte: 10 },
          }),
        }),
      );
    });

    it("applies text search when provided", async () => {
      vi.mocked(mockPrisma.venue.findMany).mockResolvedValue([]);

      const request = new Request(
        "http://localhost/api/venues/search?q=coffee",
      );
      await GET(request);

      expect(mockPrisma.venue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { name: { contains: "coffee", mode: "insensitive" } },
            ]),
          }),
        }),
      );
    });
  });

  describe("availability and metrics", () => {
    it("calculates unified capacity and price range", async () => {
      const venue = createTestVenue({
        id: "v1",
        tables: [
          {
            isActive: true,
            bookingMode: "individual",
            seats: [{ isActive: true, pricePerHour: 15 }],
          },
          {
            isActive: true,
            bookingMode: "group",
            tablePricePerHour: 40,
            seats: [{ isActive: true }, { isActive: true }],
          },
        ],
      });

      vi.mocked(mockPrisma.venue.findMany).mockResolvedValue([venue] as any);
      vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([]);

      const request = new Request("http://localhost/api/venues/search?q=test");
      const response = await GET(request);
      const data = await response.json();

      expect(data.venues[0].capacity).toBe(3); // 1 seat + 2 seats
      expect(data.venues[0].minPrice).toBe(15);
      expect(data.venues[0].maxPrice).toBe(40);
    });

    it('filters by "Available Now" correctly', async () => {
      // Mocking "now" to 10:00 AM
      const now = new Date("2024-01-22T10:00:00Z");
      vi.setSystemTime(now);

      const venue = createTestVenue({
        id: "v1",
        tables: [
          {
            isActive: true,
            seatCount: 1,
            seats: [],
            bookingMode: "individual",
          },
        ],
      });

      vi.mocked(mockPrisma.venue.findMany).mockResolvedValue([venue] as any);

      // Overlap case: reservation from 10:00 to 11:00
      vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([
        {
          venueId: "v1",
          startAt: new Date("2024-01-22T10:00:00Z"),
          endAt: new Date("2024-01-22T11:00:00Z"),
          seatCount: 1,
        },
      ] as any);

      const request = new Request(
        "http://localhost/api/venues/search?availableNow=true&q=test",
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.venues).toHaveLength(0); // Should be excluded because it's full

      vi.useRealTimers();
    });
  });
});
