import { describe, it, expect, beforeEach, vi } from "vitest"
import { createMockPrisma, createMockSession } from "../setup/mocks"
import { createTestUser, createTestVenue } from "../helpers/test-utils"

const mockPrisma = createMockPrisma()
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/venue-auth", () => ({ canEditVenue: vi.fn() }))
vi.mock("@/lib/audit", () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }))

const { POST: pausePost } = await import("@/app/api/venues/[id]/pause/route")
const { POST: unpausePost } = await import("@/app/api/venues/[id]/unpause/route")
const { POST: deletePost } = await import("@/app/api/venues/[id]/delete/route")

describe("POST /api/venues/[id]/pause", () => {
  const venueId = "venue-1"
  const owner = createTestUser({ id: "owner-1" })
  const otherUser = createTestUser({ id: "other-user" })
  const venue = createTestVenue({ id: venueId, ownerId: owner.id, status: "ACTIVE" })

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue(venue as any)
    const { auth } = await import("@/lib/auth")
    const { canEditVenue } = await import("@/lib/venue-auth")
    vi.mocked(auth).mockResolvedValue(createMockSession(otherUser))
    vi.mocked(canEditVenue).mockReturnValue(false)
  })

  it("returns 401 if not authenticated", async () => {
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth).mockResolvedValue(null)

    const req = new Request("http://localhost/api/venues/" + venueId + "/pause", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    })
    const res = await pausePost(req, { params: Promise.resolve({ id: venueId }) })
    expect(res.status).toBe(401)
  })

  it("returns 403 if user is not owner or admin", async () => {
    const req = new Request("http://localhost/api/venues/" + venueId + "/pause", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    })
    const res = await pausePost(req, { params: Promise.resolve({ id: venueId }) })
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain("permission")
  })

  it("returns 409 if venue is already DELETED", async () => {
    const { canEditVenue } = await import("@/lib/venue-auth")
    vi.mocked(canEditVenue).mockReturnValue(true)
    vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue({
      ...venue,
      status: "DELETED",
    } as any)

    const req = new Request("http://localhost/api/venues/" + venueId + "/pause", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    })
    const res = await pausePost(req, { params: Promise.resolve({ id: venueId }) })
    expect(res.status).toBe(409)
  })
})

describe("POST /api/venues/[id]/unpause", () => {
  const venueId = "venue-1"
  const venue = createTestVenue({ id: venueId, status: "PAUSED" })

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue(venue as any)
    const { auth } = await import("@/lib/auth")
    const { canEditVenue } = await import("@/lib/venue-auth")
    vi.mocked(auth).mockResolvedValue(createMockSession(createTestUser({ id: "other" })))
    vi.mocked(canEditVenue).mockReturnValue(false)
  })

  it("returns 403 if user is not owner or admin", async () => {
    const req = new Request("http://localhost/api/venues/" + venueId + "/unpause", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    const res = await unpausePost(req, { params: Promise.resolve({ id: venueId }) })
    expect(res.status).toBe(403)
  })
})

describe("POST /api/venues/[id]/delete", () => {
  const venueId = "venue-1"
  const venue = createTestVenue({ id: venueId, name: "My Venue", status: "ACTIVE" })

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue(venue as any)
    vi.mocked(mockPrisma.$transaction).mockImplementation(async (cb) => {
      const tx = {
        reservation: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        table: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        seat: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        venue: { update: vi.fn().mockResolvedValue(venue) },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      }
      return (cb as any)(tx)
    })
    const { auth } = await import("@/lib/auth")
    const { canEditVenue } = await import("@/lib/venue-auth")
    vi.mocked(auth).mockResolvedValue(createMockSession(createTestUser({ id: "other" })))
    vi.mocked(canEditVenue).mockReturnValue(false)
  })

  it("returns 403 if user is not owner or admin", async () => {
    const req = new Request("http://localhost/api/venues/" + venueId + "/delete", {
      method: "POST",
      body: JSON.stringify({ confirmation: "My Venue" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await deletePost(req, { params: Promise.resolve({ id: venueId }) })
    expect(res.status).toBe(403)
  })

  it("returns 409 if venue is already DELETED", async () => {
    const { canEditVenue } = await import("@/lib/venue-auth")
    vi.mocked(canEditVenue).mockReturnValue(true)
    vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue({
      ...venue,
      status: "DELETED",
    } as any)

    const req = new Request("http://localhost/api/venues/" + venueId + "/delete", {
      method: "POST",
      body: JSON.stringify({ confirmation: "My Venue" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await deletePost(req, { params: Promise.resolve({ id: venueId }) })
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toContain("already deleted")
  })
})
