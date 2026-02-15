"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditVenue } from "@/lib/venue-auth"
import { allocateOneQrAsset } from "@/lib/qr-asset-allocator"
import { getSeatLabel } from "@/lib/venue-ops"

export type SignageOrderShippingInput = {
  contactName: string
  contactEmail: string
  contactPhone?: string | null
  shipAddress1: string
  shipAddress2?: string | null
  shipCity: string
  shipState: string
  shipPostalCode: string
  shipCountry: string
  shippingNotes?: string | null
}

export type CreateSignageOrderInput = {
  venueId: string
  counterSign: boolean
  windowDecal: boolean
  tableTentTableIds?: string[]
  seatQrSeatIds?: string[]
  templateId: string
  shipping: SignageOrderShippingInput
}

export type CreateSignageOrderSuccess = {
  success: true
  orderId: string
  counterSignCount: number
  windowDecalCount: number
  tableCount: number
  seatCount: number
}

export type CreateSignageOrderFailure = {
  success: false
  error: string
}

export async function createSignageOrder(
  input: CreateSignageOrderInput
): Promise<CreateSignageOrderSuccess | CreateSignageOrderFailure> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: "You must be signed in to place an order." }
    }

    const {
      venueId,
      counterSign,
      windowDecal,
      tableTentTableIds = [],
      seatQrSeatIds = [],
      templateId,
      shipping,
    } = input

    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      include: {
        tables: {
          include: { seats: true },
        },
      },
    })
    if (!venue) {
      return { success: false, error: "Venue not found." }
    }
    if (!canEditVenue(session.user, venue)) {
      return { success: false, error: "You do not have permission to manage this venue." }
    }

    const template = await prisma.signageTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, isActive: true },
    })
    if (!template || !template.isActive) {
      return { success: false, error: "Template not found or inactive." }
    }

    const tableIds = new Set(venue.tables.map((t) => t.id))
    const seatIds = new Set(venue.tables.flatMap((t) => t.seats.map((s) => s.id)))
    for (const id of tableTentTableIds) {
      if (!tableIds.has(id)) {
        return { success: false, error: `Table ${id} does not belong to this venue.` }
      }
    }
    for (const id of seatQrSeatIds) {
      if (!seatIds.has(id)) {
        return { success: false, error: `Seat ${id} does not belong to this venue.` }
      }
    }

    const totalItems =
      (counterSign ? 1 : 0) + (windowDecal ? 1 : 0) + tableTentTableIds.length + seatQrSeatIds.length
    if (totalItems === 0) {
      return { success: false, error: "At least one item is required." }
    }

    const existingVenueQr = await prisma.qRAsset.findFirst({
      where: {
        venueId,
        resourceType: "venue",
        status: "ACTIVE",
      },
      select: { id: true },
    })

    const [existingTableQrs, existingSeatQrs] = await Promise.all([
      tableTentTableIds.length > 0
        ? prisma.qRAsset.findMany({
            where: {
              venueId,
              resourceType: "table",
              resourceId: { in: tableTentTableIds },
              status: "ACTIVE",
            },
            select: { id: true, resourceId: true },
          })
        : Promise.resolve([]),
      seatQrSeatIds.length > 0
        ? prisma.qRAsset.findMany({
            where: {
              venueId,
              resourceType: "seat",
              resourceId: { in: seatQrSeatIds },
              status: "ACTIVE",
            },
            select: { id: true, resourceId: true },
          })
        : Promise.resolve([]),
    ])

    const existingTableQrByTableId = new Map<string, string>()
    for (const row of existingTableQrs) {
      if (row.resourceId) existingTableQrByTableId.set(row.resourceId, row.id)
    }
    const existingSeatQrBySeatId = new Map<string, string>()
    for (const row of existingSeatQrs) {
      if (row.resourceId) existingSeatQrBySeatId.set(row.resourceId, row.id)
    }

    const needVenueQrAllocation = (counterSign || windowDecal) && !existingVenueQr
    const allocations: { id: string }[] = []

    if (needVenueQrAllocation) {
      const allocated = await allocateOneQrAsset()
      allocations.push(allocated)
    }
    for (const tableId of tableTentTableIds) {
      if (!existingTableQrByTableId.has(tableId)) {
        const allocated = await allocateOneQrAsset()
        allocations.push(allocated)
      }
    }
    for (const seatId of seatQrSeatIds) {
      if (!existingSeatQrBySeatId.has(seatId)) {
        const allocated = await allocateOneQrAsset()
        allocations.push(allocated)
      }
    }

    let venueQrAllocIndex = 0
    let tableAllocIndex = needVenueQrAllocation ? 1 : 0
    const tableAllocCount = tableTentTableIds.filter((id) => !existingTableQrByTableId.has(id)).length
    const seatAllocStart = tableAllocIndex + tableAllocCount
    let seatAllocIndex = 0

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.signageOrder.create({
        data: {
          venueId,
          createdByUserId: session.user.id,
          templateId,
          status: "NEW",
          contactName: shipping.contactName.trim(),
          contactEmail: shipping.contactEmail.trim(),
          contactPhone: shipping.contactPhone?.trim() || null,
          shipAddress1: shipping.shipAddress1.trim(),
          shipAddress2: shipping.shipAddress2?.trim() || null,
          shipCity: shipping.shipCity.trim(),
          shipState: shipping.shipState.trim(),
          shipPostalCode: shipping.shipPostalCode.trim(),
          shipCountry: shipping.shipCountry.trim(),
          shippingNotes: shipping.shippingNotes?.trim() || null,
        },
      })

      const venueQrId =
        counterSign || windowDecal
          ? existingVenueQr
            ? existingVenueQr.id
            : allocations[venueQrAllocIndex]!.id
          : null

      if (venueQrId && !existingVenueQr) {
        await tx.qRAsset.update({
          where: { id: venueQrId },
          data: {
            status: "ACTIVE",
            venueId,
            resourceType: "venue",
            resourceId: null,
            activatedAt: new Date(),
            activatedBy: session.user.id ?? session.user.email ?? null,
            activationSource: "order_fulfillment",
            reservedOrderId: null,
          },
        })
      }

      if (counterSign) {
        await tx.signageOrderItem.create({
          data: {
            orderId: newOrder.id,
            venueId,
            qrScopeType: "STORE",
            qrAssetId: venueQrId!,
            designOption: "COUNTER_SIGN",
            intendedTableId: null,
            intendedSeatId: null,
            label: "Counter Sign",
          },
        })
      }
      if (windowDecal) {
        await tx.signageOrderItem.create({
          data: {
            orderId: newOrder.id,
            venueId,
            qrScopeType: "STORE",
            qrAssetId: venueQrId!,
            designOption: "WINDOW_DECAL",
            intendedTableId: null,
            intendedSeatId: null,
            label: "Window Decal",
          },
        })
      }

      for (const tableId of tableTentTableIds) {
        const existingQrId = existingTableQrByTableId.get(tableId)
        const qrAssetId = existingQrId ?? allocations[tableAllocIndex++]!.id
        const table = venue.tables.find((t) => t.id === tableId)!
        if (!existingQrId) {
          await tx.qRAsset.update({
            where: { id: qrAssetId },
            data: {
              status: "ACTIVE",
              venueId,
              resourceType: "table",
              resourceId: tableId,
              reservedOrderId: newOrder.id,
              activatedAt: new Date(),
              activatedBy: session.user.id ?? session.user.email ?? null,
              activationSource: "order_fulfillment",
            },
          })
        }
        await tx.signageOrderItem.create({
          data: {
            orderId: newOrder.id,
            venueId,
            qrScopeType: "TABLE",
            qrAssetId,
            designOption: "TABLE_TENT",
            intendedTableId: tableId,
            intendedSeatId: null,
            label: table.name?.trim() || "Table",
          },
        })
      }

      for (const seatId of seatQrSeatIds) {
        const existingQrId = existingSeatQrBySeatId.get(seatId)
        const qrAssetId = existingQrId ?? allocations[seatAllocStart + seatAllocIndex++]!.id
        const seatObj = venue.tables.flatMap((t) => t.seats).find((s) => s.id === seatId)!
        const table = venue.tables.find((t) => t.seats.some((s) => s.id === seatId))!
        const label = `${getSeatLabel(seatObj)} — ${table.name?.trim() || "Table"}`
        if (!existingQrId) {
          await tx.qRAsset.update({
            where: { id: qrAssetId },
            data: {
              status: "ACTIVE",
              venueId,
              resourceType: "seat",
              resourceId: seatId,
              reservedOrderId: newOrder.id,
              activatedAt: new Date(),
              activatedBy: session.user.id ?? session.user.email ?? null,
              activationSource: "order_fulfillment",
            },
          })
        }
        await tx.signageOrderItem.create({
          data: {
            orderId: newOrder.id,
            venueId,
            qrScopeType: "SEAT",
            qrAssetId,
            designOption: "STANDARD_SEAT_QR",
            intendedTableId: table.id,
            intendedSeatId: seatId,
            label,
          },
        })
      }

      return newOrder
    })

    return {
      success: true,
      orderId: order.id,
      counterSignCount: counterSign ? 1 : 0,
      windowDecalCount: windowDecal ? 1 : 0,
      tableCount: tableTentTableIds.length,
      seatCount: seatQrSeatIds.length,
    }
  } catch (err) {
    console.error("createSignageOrder error:", err)
    const message = err instanceof Error ? err.message : "Failed to create order."
    return { success: false, error: message }
  }
}
