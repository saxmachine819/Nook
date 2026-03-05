import { NextRequest, NextResponse } from "next/server"
import { PassThrough } from "stream"
import archiver from "archiver"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getQRBaseUrl } from "@/lib/qr-asset-utils"
import { isAdmin } from "@/lib/venue-auth"
import { generatePlainManufacturingPNG } from "@/lib/qr-sticker-generator"

const MANUFACTURING_PREFIX = "manufacturing-"

function sanitizeFilenamePrefix(label: string | null): string {
  if (!label || !label.trim()) return "manufacturing"
  return label
    .trim()
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .slice(0, 80)
}

function collectStream(stream: PassThrough): Promise<Buffer> {
  const chunks: Buffer[] = []
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => chunks.push(chunk))
    stream.on("end", () => resolve(Buffer.concat(chunks)))
    stream.on("error", reject)
  })
}

export async function GET(
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
      select: { id: true, token: true, manufacturingPng: true, batchLabel: true },
      orderBy: { createdAt: "asc" },
    })

    if (assets.length === 0) {
      return NextResponse.json(
        { error: "No manufacturing batch found for this batchId" },
        { status: 404 }
      )
    }

    const baseUrl = getQRBaseUrl(request)
    const prefix = sanitizeFilenamePrefix(assets[0]?.batchLabel ?? null)

    const pngBuffers: Buffer[] = []
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i]!
      let png: Buffer
      if (asset.manufacturingPng != null && asset.manufacturingPng.length > 0) {
        png = Buffer.from(asset.manufacturingPng)
      } else {
        const qrUrl = `${baseUrl}/q/${asset.token}`
        png = await generatePlainManufacturingPNG({ qrUrl })
        await prisma.qRAsset.update({
          where: { id: asset.id },
          data: { manufacturingPng: png },
        })
      }
      pngBuffers.push(png)
    }

    const stream = new PassThrough()
    const archive = archiver("zip", { zlib: { level: 9 } })
    archive.on("error", (err) => {
      stream.destroy(err)
    })
    archive.pipe(stream)

    for (let i = 0; i < pngBuffers.length; i++) {
      const name = `${prefix}-${String(i + 1).padStart(3, "0")}.png`
      archive.append(pngBuffers[i], { name })
    }

    archive.finalize()
    const zipBuffer = await collectStream(stream)

    const filename = `manufacturing-pack-${batchId}.zip`
    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("[manufacturing-pack zip]", error)
    const message = error instanceof Error ? error.message : "Failed to build manufacturing pack"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
