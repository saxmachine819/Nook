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
const { GET } = await import("@/app/api/venues/pins/route");
const { batchGetCanonicalVenueHours, getOpenStatus } = await import(
  "@/lib/hours"
);

describe("GET /api/venues/pins", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache.clearAll();
    vi.mocked(mockPrisma.venue.findMany).mockResolvedValue([]);
    vi.mocked(batchGetCanonicalVenueHours).mockResolvedValue(new Map());
    vi.mocked(getOpenStatus).mockReturnValue({
      isOpen: true,
      status: "AVAILABLE_NOW",
      todayHoursText: "9 AM - 5 PM",
      nextOpenAt: null,
    } as any);
  });

  it("returns 400 for incomplete map bounds", async () => {
    const request = new Request(
      "http://localhost/api/venues/pins?north=10&south=5",
    );
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("returns pins within map bounds", async () => {
    const venue = createTestVenue({
      id: "v1",
      latitude: 7,
      longitude: 7,
      tables: [
        {
          isActive: true,
          bookingMode: "individual",
          seats: [{ isActive: true, pricePerHour: 20 }],
        },
      ],
    });
    vi.mocked(mockPrisma.venue.findMany).mockResolvedValue([venue] as any);
    vi.mocked(batchGetCanonicalVenueHours).mockResolvedValue(
      new Map([
        ["v1", { timezone: "UTC", weeklyHours: createTestVenueHours() } as any],
      ]),
    );

    const request = new Request(
      "http://localhost/api/venues/pins?north=10&south=5&east=10&west=5",
    );
    const response = await GET(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.pins).toHaveLength(1);
    expect(data.pins[0].id).toBe("v1");
    expect(data.pins[0].minPrice).toBe(20);
  });

  it("reflects open status in pins", async () => {
    const venue = createTestVenue({
      id: "v1",
      latitude: 7,
      longitude: 7,
      tables: [],
    });
    vi.mocked(mockPrisma.venue.findMany).mockResolvedValue([venue] as any);
    vi.mocked(batchGetCanonicalVenueHours).mockResolvedValue(
      new Map([
        ["v1", { timezone: "UTC", weeklyHours: createTestVenueHours() } as any],
      ]),
    );

    vi.mocked(getOpenStatus).mockReturnValue({
      isOpen: false,
      status: "CLOSED",
      todayHoursText: "Closed",
      nextOpenAt: null,
    } as any);

    const request = new Request(
      "http://localhost/api/venues/pins?north=10&south=5&east=10&west=5",
    );
    const response = await GET(request);
    const data = await response.json();

    expect(data.pins[0].status).toBe("CLOSED");
  });
});
