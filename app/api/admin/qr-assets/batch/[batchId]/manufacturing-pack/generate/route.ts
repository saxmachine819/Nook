import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getQRBaseUrl } from "@/lib/qr-asset-utils"
import { isAdmin } from "@/lib/venue-auth"
import { generatePlainManufacturingPNG } from "@/lib/qr-sticker-generator"

const MANUFACTURING_PREFIX = "manufacturing-"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ batchId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 })
    }
    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { batchId } = await context.params
    if (!batchId) {
      return NextResponse.json({ error: "batchId is required" }, { status: 400 })
    }

    const assets = await prisma.qRAsset.findMany({
      where: {
        batchId,
        reservedOrderId: `${MANUFACTURING_PREFIX}${batchId}`,
      },
      select: { id: true, token: true, manufacturingPng: true },
      orderBy: { createdAt: "asc" },
    })

    if (assets.length === 0) {
      return NextResponse.json(
        { error: "No manufacturing batch found for this batchId" },
        { status: 404 }
      )
    }

    const baseUrl = getQRBaseUrl(request)
    let generated = 0
    let skipped = 0

    for (const asset of assets) {
      if (asset.manufacturingPng != null && asset.manufacturingPng.length > 0) {
        skipped++
        continue
      }
      const qrUrl = `${baseUrl}/q/${asset.token}`
      const pngBuffer = await generatePlainManufacturingPNG({ qrUrl })
      await prisma.qRAsset.update({
        where: { id: asset.id },
        data: { manufacturingPng: pngBuffer },
      })
      generated++
    }

    return NextResponse.json(
      { generated, skipped, total: assets.length },
      { status: 200 }
    )
  } catch (error) {
    console.error("[manufacturing-pack generate]", error)
    const message = error instanceof Error ? error.message : "Failed to generate manufacturing assets"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
