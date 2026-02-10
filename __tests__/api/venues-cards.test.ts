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

// Import route after mocks are set up
const { GET } = await import("@/app/api/venues/cards/route");
const { batchGetCanonicalVenueHours, getOpenStatus } = await import(
  "@/lib/hours"
);

describe("GET /api/venues/cards", () => {
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

  it("fetches specific venues by IDs (prefetch)", async () => {
    const mockVenues = [
      createTestVenue({ id: "v1", latitude: 10, longitude: 10, tables: [] }),
      createTestVenue({ id: "v2", latitude: 10, longitude: 10, tables: [] }),
    ];
    vi.mocked(mockPrisma.venue.findMany).mockResolvedValue(mockVenues as any);
    vi.mocked(batchGetCanonicalVenueHours).mockResolvedValue(
      new Map([
        ["v1", { timezone: "UTC", weeklyHours: createTestVenueHours() } as any],
        ["v2", { timezone: "UTC", weeklyHours: createTestVenueHours() } as any],
      ]),
    );

    const request = new Request("http://localhost/api/venues/cards?ids=v1,v2");
    const response = await GET(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.venues).toHaveLength(2);
    expect(mockPrisma.venue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ["v1", "v2"] },
        }),
      }),
    );
  });

  it.skip("calculates unified metrics (capacity, price) correctly", async () => {
    const venue = createTestVenue({
      id: "v1",
      latitude: 10,
      longitude: 10,
      tables: [
        {
          isActive: true,
          bookingMode: "individual",
          seats: [{ isActive: true, pricePerHour: 25 }],
        },
      ],
    });
    vi.mocked(mockPrisma.venue.findMany).mockResolvedValue([venue] as any);

    const request = new Request("http://localhost/api/venues/cards?ids=v1");
    const response = await GET(request);
    const data = await response.json();

    expect(data.venues[0].capacity).toBe(1);
    expect(data.venues[0].minPrice).toBe(25);
  });

  it("processes image URLs with hero priority", async () => {
    const venue = createTestVenue({
      id: "v1",
      latitude: 10,
      longitude: 10,
      heroImageUrl: "http://hero.jpg",
      imageUrls: JSON.stringify(["http://img1.jpg", "http://img2.jpg"]),
      tables: [],
    });
    vi.mocked(mockPrisma.venue.findMany).mockResolvedValue([venue] as any);

    const request = new Request("http://localhost/api/venues/cards?ids=v1");
    const response = await GET(request);
    const data = await response.json();

    expect(data.venues[0].imageUrl).toBe("http://hero.jpg");
    expect(data.venues[0].imageUrls[0]).toBe("http://hero.jpg");
    expect(data.venues[0].imageUrls).toContain("http://img1.jpg");
    expect(data.venues[0].imageUrls).toHaveLength(3);
  });

  it("returns 400 for incomplete map bounds", async () => {
    const request = new Request(
      "http://localhost/api/venues/cards?north=10&south=5",
    );
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it('handles "availableNow" filter', async () => {
    const venue = createTestVenue({
      id: "v1",
      latitude: 10,
      longitude: 10,
      tables: [
        { isActive: true, seatCount: 1, seats: [], bookingMode: "individual" },
      ],
    });
    vi.mocked(mockPrisma.venue.findMany).mockResolvedValue([venue] as any);
    vi.mocked(batchGetCanonicalVenueHours).mockResolvedValue(
      new Map([
        ["v1", { timezone: "UTC", weeklyHours: createTestVenueHours() } as any],
      ]),
    );

    // Mock as closed
    vi.mocked(getOpenStatus).mockReturnValue({ isOpen: false } as any);

    const request = new Request(
      "http://localhost/api/venues/cards?availableNow=true&q=test",
    );
    const response = await GET(request);
    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.venues).toHaveLength(0);
  });
});
