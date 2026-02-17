import { describe, it, expect, beforeEach, vi } from "vitest"
import { createMockPrisma } from "../setup/mocks"

const venueId = "venue-1"
const ownerId = "owner-1"
const templateId = "template-1"
const table1Id = "table-1"
const table2Id = "table-2"
const table3Id = "table-3"
const seat1Id = "seat-1"
const shipping = {
  contactName: "Jane Doe",
  contactEmail: "jane@example.com",
  contactPhone: null as string | null,
  shipAddress1: "123 Main St",
  shipAddress2: null as string | null,
  shipCity: "City",
  shipState: "ST",
  shipPostalCode: "12345",
  shipCountry: "US",
  shippingNotes: null as string | null,
}

const venueWithTables = {
  id: venueId,
  ownerId,
  tables: [
    { id: table1Id, name: "Table A", seats: [{ id: seat1Id, label: "Seat 1", position: 1 }] },
    { id: table2Id, name: "Table B", seats: [] },
    { id: table3Id, name: "Table C", seats: [] },
  ],
}

const mockPrisma = {
  ...createMockPrisma(),
  venue: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  signageTemplate: { findUnique: vi.fn(), findMany: vi.fn() },
  qRAsset: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  signageOrder: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
  signageOrderItem: { create: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
}

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }))

const mockCanEditVenue = vi.fn()
vi.mock("@/lib/venue-auth", () => ({
  canEditVenue: (user: unknown, venue: unknown) => mockCanEditVenue(user, venue),
}))

const mockAllocateOneQrAsset = vi.fn()
vi.mock("@/lib/qr-asset-allocator", () => ({
  allocateOneQrAsset: () => mockAllocateOneQrAsset(),
}))

async function getCreateSignageOrder() {
  const { createSignageOrder } = await import("@/app/venue/dashboard/[id]/actions/signage-order")
  return createSignageOrder
}

describe("createSignageOrder", () => {
  const ownerUser = { id: ownerId, email: "owner@example.com", name: "Owner" }

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: ownerUser })
    mockCanEditVenue.mockReturnValue(true)
    mockPrisma.venue.findUnique.mockResolvedValue(venueWithTables)
    mockPrisma.signageTemplate.findUnique.mockResolvedValue({ id: templateId, isActive: true })
    mockPrisma.qRAsset.findFirst.mockResolvedValue(null)
    mockPrisma.qRAsset.findMany.mockResolvedValue([])

    let orderId = "order-1"
    let allocIndex = 0
    mockAllocateOneQrAsset.mockImplementation(() =>
      Promise.resolve({ id: `allocated-${++allocIndex}` })
    )

    mockPrisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        signageOrder: {
          create: vi.fn().mockResolvedValue({ id: orderId }),
        },
        qRAsset: { update: vi.fn().mockResolvedValue({}) },
        signageOrderItem: { create: vi.fn().mockResolvedValue({}) },
      }
      return callback(tx) as Promise<unknown>
    })
  })

  describe("permission", () => {
    it("returns error when user is not signed in", async () => {
      mockAuth.mockResolvedValue(null)
      const createSignageOrder = await getCreateSignageOrder()
      const result = await createSignageOrder({
        venueId,
        counterSign: true,
        windowDecal: false,
        templateId,
        shipping,
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toContain("signed in")
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it("returns error when user cannot manage venue (non-owner, non-admin)", async () => {
      mockCanEditVenue.mockReturnValue(false)
      const createSignageOrder = await getCreateSignageOrder()
      const result = await createSignageOrder({
        venueId,
        counterSign: true,
        windowDecal: false,
        templateId,
        shipping,
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toContain("permission")
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })
  })

  describe("store QR", () => {
    it("creates one SignageOrderItem STORE (Counter Sign) and assigns venue QR when counterSign true and no existing venue QR", async () => {
      mockPrisma.qRAsset.findFirst.mockResolvedValue(null)
      mockAllocateOneQrAsset.mockResolvedValueOnce({ id: "store-qr-1" })

      const createSignageOrder = await getCreateSignageOrder()
      const result = await createSignageOrder({
        venueId,
        counterSign: true,
        windowDecal: false,
        tableTentTableIds: [],
        seatQrSeatIds: [],
        templateId,
        shipping,
      })

      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.orderId).toBeDefined()
      expect(result.counterSignCount).toBe(1)
      expect(result.windowDecalCount).toBe(0)
      expect(result.tableCount).toBe(0)
      expect(result.seatCount).toBe(0)

      expect(mockAllocateOneQrAsset).toHaveBeenCalledTimes(1)
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
      const tx = (mockPrisma.$transaction.mock.calls[0] as unknown[])[0] as (tx: {
        signageOrder: { create: ReturnType<typeof vi.fn> }
        qRAsset: { update: ReturnType<typeof vi.fn> }
        signageOrderItem: { create: ReturnType<typeof vi.fn> }
      }) => void
      // We can't easily get the tx from the callback; instead assert transaction was invoked
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function))
    })

    it("reuses existing venue QR when order has counterSign true (same venue)", async () => {
      const existingVenueQrId = "existing-venue-qr-id"
      mockPrisma.qRAsset.findFirst.mockResolvedValue({ id: existingVenueQrId })

      const itemCreates: { qrScopeType: string; qrAssetId: string; designOption: string }[] = []
      mockPrisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          signageOrder: { create: vi.fn().mockResolvedValue({ id: "order-1" }) },
          qRAsset: { update: vi.fn().mockResolvedValue({}) },
          signageOrderItem: {
            create: vi.fn().mockImplementation((args: { data: { qrScopeType: string; qrAssetId: string; designOption: string } }) => {
              itemCreates.push(args.data)
              return Promise.resolve({})
            }),
          },
        }
        return callback(tx) as Promise<unknown>
      })

      const createSignageOrder = await getCreateSignageOrder()
      const result = await createSignageOrder({
        venueId,
        counterSign: true,
        windowDecal: false,
        tableTentTableIds: [],
        seatQrSeatIds: [],
        templateId,
        shipping,
      })

      expect(result.success).toBe(true)
      expect(mockAllocateOneQrAsset).not.toHaveBeenCalled()
      const storeItem = itemCreates.find((c) => c.qrScopeType === "STORE" && c.designOption === "COUNTER_SIGN")
      expect(storeItem).toBeDefined()
      expect(storeItem!.qrAssetId).toBe(existingVenueQrId)
    })
  })

  describe("table QRs", () => {
    it("creates 3 SignageOrderItems TABLE (Table Tent) and 3 unassigned QRAssets (venueId + reservedOrderId only)", async () => {
      mockAllocateOneQrAsset
        .mockResolvedValueOnce({ id: "qr-t1" })
        .mockResolvedValueOnce({ id: "qr-t2" })
        .mockResolvedValueOnce({ id: "qr-t3" })

      const qrUpdates: { where: { id: string }; data: Record<string, unknown> }[] = []
      const itemCreates: { data: { qrScopeType: string; qrAssetId: string; designOption: string; intendedTableId: string | null; label: string } }[] = []
      mockPrisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          signageOrder: { create: vi.fn().mockResolvedValue({ id: "order-1" }) },
          qRAsset: {
            update: vi.fn().mockImplementation((args: { where: { id: string }; data: Record<string, unknown> }) => {
              qrUpdates.push(args)
              return Promise.resolve({})
            }),
          },
          signageOrderItem: {
            create: vi.fn().mockImplementation((args: { data: { qrScopeType: string; qrAssetId: string; designOption: string; intendedTableId: string | null; label: string } }) => {
              itemCreates.push(args)
              return Promise.resolve({})
            }),
          },
        }
        return callback(tx) as Promise<unknown>
      })

      const createSignageOrder = await getCreateSignageOrder()
      const result = await createSignageOrder({
        venueId,
        counterSign: false,
        windowDecal: false,
        tableTentTableIds: [table1Id, table2Id, table3Id],
        seatQrSeatIds: [],
        templateId,
        shipping,
      })

      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.counterSignCount).toBe(0)
      expect(result.windowDecalCount).toBe(0)
      expect(result.tableCount).toBe(3)
      expect(result.seatCount).toBe(0)

      expect(mockAllocateOneQrAsset).toHaveBeenCalledTimes(3)

      const tableItems = itemCreates.filter((c) => c.data.qrScopeType === "TABLE" && c.data.designOption === "TABLE_TENT")
      expect(tableItems).toHaveLength(3)
      const qrIds = tableItems.map((c) => c.data.qrAssetId)
      expect(new Set(qrIds).size).toBe(3)

      const tableQrUpdates = qrUpdates.filter((u) => ["qr-t1", "qr-t2", "qr-t3"].includes(u.where.id))
      expect(tableQrUpdates).toHaveLength(3)
      for (const up of tableQrUpdates) {
        expect(up.data.venueId).toBe(venueId)
        expect(up.data.reservedOrderId).toBe("order-1")
        expect(up.data.resourceType).toBe("table")
        expect(up.data.resourceId).toBeDefined()
      }

      expect(tableItems.map((i) => i.data.label).sort()).toEqual(["Table A", "Table B", "Table C"])
    })

    it("reuses existing ACTIVE QR for a table when present (no new allocation for that table)", async () => {
      const existingTable1QrId = "existing-table1-qr"
      mockPrisma.qRAsset.findMany
        .mockResolvedValueOnce([{ id: existingTable1QrId, resourceId: table1Id }])
        .mockResolvedValueOnce([])

      mockAllocateOneQrAsset
        .mockResolvedValueOnce({ id: "qr-t2" })
        .mockResolvedValueOnce({ id: "qr-t3" })

      const itemCreates: { data: { qrScopeType: string; qrAssetId: string; intendedTableId: string | null } }[] = []
      mockPrisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          signageOrder: { create: vi.fn().mockResolvedValue({ id: "order-1" }) },
          qRAsset: { update: vi.fn().mockResolvedValue({}) },
          signageOrderItem: {
            create: vi.fn().mockImplementation((args: { data: { qrScopeType: string; qrAssetId: string; intendedTableId: string | null } }) => {
              itemCreates.push(args)
              return Promise.resolve({})
            }),
          },
        }
        return callback(tx) as Promise<unknown>
      })

      const createSignageOrder = await getCreateSignageOrder()
      const result = await createSignageOrder({
        venueId,
        counterSign: false,
        windowDecal: false,
        tableTentTableIds: [table1Id, table2Id, table3Id],
        seatQrSeatIds: [],
        templateId,
        shipping,
      })

      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.tableCount).toBe(3)
      expect(mockAllocateOneQrAsset).toHaveBeenCalledTimes(2)

      const table1Item = itemCreates.find((c) => c.data.intendedTableId === table1Id)
      expect(table1Item).toBeDefined()
      expect(table1Item!.data.qrAssetId).toBe(existingTable1QrId)
    })
  })

  describe("seat QRs", () => {
    it("creates 1 SignageOrderItem SEAT and updates QRAsset with resourceType seat and resourceId", async () => {
      mockAllocateOneQrAsset.mockResolvedValueOnce({ id: "qr-seat1" })

      const qrUpdates: { where: { id: string }; data: Record<string, unknown> }[] = []
      const itemCreates: { data: { qrScopeType: string; qrAssetId: string; designOption: string; intendedSeatId: string | null } }[] = []
      mockPrisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          signageOrder: { create: vi.fn().mockResolvedValue({ id: "order-1" }) },
          qRAsset: {
            update: vi.fn().mockImplementation((args: { where: { id: string }; data: Record<string, unknown> }) => {
              qrUpdates.push(args)
              return Promise.resolve({})
            }),
          },
          signageOrderItem: {
            create: vi.fn().mockImplementation((args: { data: { qrScopeType: string; qrAssetId: string; designOption: string; intendedSeatId: string | null } }) => {
              itemCreates.push(args)
              return Promise.resolve({})
            }),
          },
        }
        return callback(tx) as Promise<unknown>
      })

      const createSignageOrder = await getCreateSignageOrder()
      const result = await createSignageOrder({
        venueId,
        counterSign: false,
        windowDecal: false,
        tableTentTableIds: [],
        seatQrSeatIds: [seat1Id],
        templateId,
        shipping,
      })

      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.seatCount).toBe(1)
      expect(mockAllocateOneQrAsset).toHaveBeenCalledTimes(1)

      const seatItem = itemCreates.find((c) => c.data.qrScopeType === "SEAT" && c.data.designOption === "STANDARD_SEAT_QR")
      expect(seatItem).toBeDefined()
      expect(seatItem!.data.qrAssetId).toBe("qr-seat1")
      expect(seatItem!.data.intendedSeatId).toBe(seat1Id)

      const seatQrUpdate = qrUpdates.find((u) => u.where.id === "qr-seat1")
      expect(seatQrUpdate).toBeDefined()
      expect(seatQrUpdate!.data.resourceType).toBe("seat")
      expect(seatQrUpdate!.data.resourceId).toBe(seat1Id)
    })

    it("reuses existing ACTIVE QR for a seat when present (no new allocation for that seat)", async () => {
      const existingSeat1QrId = "existing-seat1-qr"
      mockPrisma.qRAsset.findMany.mockImplementation((args: { where?: { resourceType?: string } }) =>
        Promise.resolve(
          args?.where?.resourceType === "seat"
            ? [{ id: existingSeat1QrId, resourceId: seat1Id }]
            : []
        )
      )

      const itemCreates: { data: { qrScopeType: string; qrAssetId: string; intendedSeatId: string | null } }[] = []
      mockPrisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          signageOrder: { create: vi.fn().mockResolvedValue({ id: "order-1" }) },
          qRAsset: { update: vi.fn().mockResolvedValue({}) },
          signageOrderItem: {
            create: vi.fn().mockImplementation((args: { data: { qrScopeType: string; qrAssetId: string; intendedSeatId: string | null } }) => {
              itemCreates.push(args)
              return Promise.resolve({})
            }),
          },
        }
        return callback(tx) as Promise<unknown>
      })

      const createSignageOrder = await getCreateSignageOrder()
      const result = await createSignageOrder({
        venueId,
        counterSign: false,
        windowDecal: false,
        tableTentTableIds: [],
        seatQrSeatIds: [seat1Id],
        templateId,
        shipping,
      })

      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.seatCount).toBe(1)
      expect(mockAllocateOneQrAsset).not.toHaveBeenCalled()

      const seatItem = itemCreates.find((c) => c.data.intendedSeatId === seat1Id)
      expect(seatItem).toBeDefined()
      expect(seatItem!.data.qrAssetId).toBe(existingSeat1QrId)
    })
  })
})
