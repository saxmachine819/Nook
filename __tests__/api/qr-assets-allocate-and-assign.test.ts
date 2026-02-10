import { describe, it, expect, beforeEach, vi } from "vitest"
import { createMockPrisma } from "../setup/mocks"

const mockPrisma = {
  ...createMockPrisma(),
  venue: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  qRAsset: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  seat: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  table: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}
vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const mockAuth = vi.fn()
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}))

const mockCanEditVenue = vi.fn()
const mockIsAdmin = vi.fn()
vi.mock("@/lib/venue-auth", () => ({
  canEditVenue: (user: unknown, venue: unknown) => mockCanEditVenue(user, venue),
  isAdmin: (user: { email?: string | null } | null | undefined) => mockIsAdmin(user),
}))

const mockAllocateOneQrAsset = vi.fn()
vi.mock("@/lib/qr-asset-allocator", () => ({
  allocateOneQrAsset: () => mockAllocateOneQrAsset(),
}))

const { POST } = await import("@/app/api/qr-assets/allocate-and-assign/route")

function jsonRequest(body: object) {
  return new Request("http://localhost/api/qr-assets/allocate-and-assign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/qr-assets/allocate-and-assign", () => {
  const venueId = "venue-1"
  const ownerUser = { id: "owner-id", email: "owner@example.com", name: "Owner" }
  const existingVenueQr = { id: "qr-1", token: "existing-venue-token", status: "ACTIVE" }

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.venue.findUnique.mockResolvedValue({ id: venueId, ownerId: ownerUser.id })
    mockPrisma.qRAsset.findFirst.mockResolvedValue(null)
    mockAllocateOneQrAsset.mockResolvedValue({ id: "allocated-1" })
    mockPrisma.qRAsset.update.mockResolvedValue({
      id: "allocated-1",
      token: "new-token",
      status: "ACTIVE",
    })
  })

  describe("venue QR (resourceType: venue)", () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: ownerUser })
      mockIsAdmin.mockReturnValue(false)
      mockCanEditVenue.mockReturnValue(true)
    })

    it("returns 401 if user is not authenticated", async () => {
      mockAuth.mockResolvedValue(null)
      const res = await POST(jsonRequest({ venueId, resourceType: "venue" }))
      const data = await res.json()
      expect(res.status).toBe(401)
      expect(data.error).toContain("signed in")
    })

    it("returns 400 if resourceType is invalid", async () => {
      const res = await POST(jsonRequest({ venueId, resourceType: "invalid" }))
      const data = await res.json()
      expect(res.status).toBe(400)
      expect(data.error).toMatch(/resourceType must be/)
    })

    it("returns 400 if venueId is missing", async () => {
      const res = await POST(jsonRequest({ resourceType: "venue" }))
      const data = await res.json()
      expect(res.status).toBe(400)
      expect(data.error).toContain("venueId")
    })

    it("returns 403 if user cannot manage venue", async () => {
      mockCanEditVenue.mockReturnValue(false)
      mockIsAdmin.mockReturnValue(false)
      const res = await POST(jsonRequest({ venueId, resourceType: "venue" }))
      const data = await res.json()
      expect(res.status).toBe(403)
      expect(data.error).toContain("permission")
    })

    it("returns 200 and existing token when venue QR already exists (idempotent)", async () => {
      mockPrisma.qRAsset.findFirst.mockResolvedValue(existingVenueQr)
      const res = await POST(jsonRequest({ venueId, resourceType: "venue" }))
      const data = await res.json()
      expect(res.status).toBe(200)
      expect(data.token).toBe("existing-venue-token")
      expect(data.alreadyExisted).toBe(true)
      expect(mockAllocateOneQrAsset).not.toHaveBeenCalled()
      expect(mockPrisma.qRAsset.update).not.toHaveBeenCalled()
    })

    it("returns 200 and new token when creating venue QR", async () => {
      const res = await POST(jsonRequest({ venueId, resourceType: "venue" }))
      const data = await res.json()
      expect(res.status).toBe(200)
      expect(data.token).toBe("new-token")
      expect(data.alreadyExisted).toBe(false)
      expect(mockPrisma.qRAsset.findFirst).toHaveBeenCalledWith({
        where: {
          venueId,
          resourceType: "venue",
          resourceId: null,
          status: "ACTIVE",
        },
        select: { id: true, token: true, status: true },
      })
      expect(mockAllocateOneQrAsset).toHaveBeenCalled()
      const updateCall = mockPrisma.qRAsset.update.mock.calls[0][0]
      expect(updateCall.where).toEqual({ id: "allocated-1" })
      expect(updateCall.data).toMatchObject({
        venueId,
        resourceType: "venue",
        resourceId: null,
        status: "ACTIVE",
      })
    })
  })

  describe("seat/table QR unchanged", () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: ownerUser })
      mockIsAdmin.mockReturnValue(false)
      mockCanEditVenue.mockReturnValue(true)
    })

    it("returns 400 for seat without resourceId", async () => {
      const res = await POST(jsonRequest({ venueId, resourceType: "seat" }))
      const data = await res.json()
      expect(res.status).toBe(400)
      expect(data.error).toContain("resourceId")
    })

    it("returns 400 for table without resourceId", async () => {
      const res = await POST(jsonRequest({ venueId, resourceType: "table" }))
      const data = await res.json()
      expect(res.status).toBe(400)
      expect(data.error).toContain("resourceId")
    })
  })
})
