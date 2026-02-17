import { describe, it, expect, beforeEach, vi } from "vitest"
import { createMockPrisma } from "../setup/mocks"

const mockPrisma = {
  ...createMockPrisma(),
  signageOrder: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
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

const mockIsAdmin = vi.fn()
vi.mock("@/lib/venue-auth", () => ({
  isAdmin: (user: { email?: string | null } | null | undefined) => mockIsAdmin(user),
}))

const orderId = "order-1"
const adminUser = { id: "admin-id", email: "admin@example.com", name: "Admin" }
const regularUser = { id: "user-id", email: "user@example.com", name: "User" }

async function getPATCH() {
  const mod = await import("@/app/api/admin/orders/[id]/route")
  return mod.PATCH
}

function patchRequest(body: object) {
  return new Request(`http://localhost/api/admin/orders/${orderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("PATCH /api/admin/orders/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.signageOrder.findUnique.mockResolvedValue({
      id: orderId,
      status: "NEW",
    })
    mockPrisma.signageOrder.update.mockImplementation((args: { where: { id: string }; data: object }) =>
      Promise.resolve({ id: args.where.id, ...args.data })
    )
  })

  describe("authorization", () => {
    it("returns 401 if user is not authenticated", async () => {
      mockAuth.mockResolvedValue(null)

      const PATCH = await getPATCH()
      const res = await PATCH(patchRequest({ status: "IN_PRODUCTION" }), {
        params: Promise.resolve({ id: orderId }),
      })
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data.error).toBeDefined()
      expect(mockPrisma.signageOrder.update).not.toHaveBeenCalled()
    })

    it("returns 403 if user is not admin", async () => {
      mockAuth.mockResolvedValue({ user: regularUser })
      mockIsAdmin.mockReturnValue(false)

      const PATCH = await getPATCH()
      const res = await PATCH(patchRequest({ status: "IN_PRODUCTION" }), {
        params: Promise.resolve({ id: orderId }),
      })
      const data = await res.json()

      expect(res.status).toBe(403)
      expect(data.error).toBe("Forbidden")
      expect(mockPrisma.signageOrder.update).not.toHaveBeenCalled()
    })
  })

  describe("admin can update status and tracking", () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: adminUser })
      mockIsAdmin.mockReturnValue(true)
    })

    it("allows transition NEW -> IN_PRODUCTION", async () => {
      const PATCH = await getPATCH()
      const res = await PATCH(patchRequest({ status: "IN_PRODUCTION" }), {
        params: Promise.resolve({ id: orderId }),
      })
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.status).toBe("IN_PRODUCTION")
      expect(mockPrisma.signageOrder.update).toHaveBeenCalledWith({
        where: { id: orderId },
        data: { status: "IN_PRODUCTION" },
      })
    })

    it("allows transition to SHIPPED with tracking and sets shippedAt", async () => {
      mockPrisma.signageOrder.findUnique.mockResolvedValue({
        id: orderId,
        status: "IN_PRODUCTION",
      })

      const PATCH = await getPATCH()
      const res = await PATCH(
        patchRequest({
          status: "SHIPPED",
          trackingCarrier: "USPS",
          trackingNumber: "123456789",
        }),
        { params: Promise.resolve({ id: orderId }) }
      )
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.status).toBe("SHIPPED")
      expect(data.trackingCarrier).toBe("USPS")
      expect(data.trackingNumber).toBe("123456789")
      expect(data.shippedAt).toBeDefined()
      expect(mockPrisma.signageOrder.update).toHaveBeenCalledWith({
        where: { id: orderId },
        data: expect.objectContaining({
          status: "SHIPPED",
          trackingCarrier: "USPS",
          trackingNumber: "123456789",
          shippedAt: expect.any(Date),
        }),
      })
    })

    it("returns 404 if order not found", async () => {
      mockPrisma.signageOrder.findUnique.mockResolvedValue(null)

      const PATCH = await getPATCH()
      const res = await PATCH(patchRequest({ status: "IN_PRODUCTION" }), {
        params: Promise.resolve({ id: orderId }),
      })
      const data = await res.json()

      expect(res.status).toBe(404)
      expect(data.error).toContain("not found")
      expect(mockPrisma.signageOrder.update).not.toHaveBeenCalled()
    })

    it("returns 400 for invalid status transition", async () => {
      mockPrisma.signageOrder.findUnique.mockResolvedValue({
        id: orderId,
        status: "SHIPPED",
      })

      const PATCH = await getPATCH()
      const res = await PATCH(patchRequest({ status: "NEW" }), {
        params: Promise.resolve({ id: orderId }),
      })
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toMatch(/Cannot transition/)
      expect(mockPrisma.signageOrder.update).not.toHaveBeenCalled()
    })
  })
})
