import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getQRBaseUrl } from "@/lib/qr-asset-utils"
import { isAdmin } from "@/lib/venue-auth"
import { generateQRStickerSVG } from "@/lib/qr-sticker-generator"
import { renderQrGridPdf } from "@/lib/pdf-qr-grid"

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null
  const n = Number.parseInt(value, 10)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
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

    const limitRaw = parsePositiveInt(new URL(request.url).searchParams.get("limit"))
    const limit = Math.min(limitRaw ?? 24, 120)

    const assets = await prisma.qRAsset.findMany({
      where: { batchId },
      select: { token: true },
      orderBy: { createdAt: "asc" },
      take: limit,
    })

    if (assets.length === 0) {
      return NextResponse.json(
        { error: "No QR assets found for this batchId" },
        { status: 404 }
      )
    }

    const baseUrl = getQRBaseUrl(request)
    const svgs = await Promise.all(
      assets.map((a) =>
        generateQRStickerSVG({
          token: a.token,
          qrUrl: `${baseUrl}/q/${a.token}`,
        })
      )
    )

    const fileName = `nooc-qr-batch-${encodeURIComponent(batchId)}.pdf`
    const pdfBuffer = await renderQrGridPdf(svgs)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename=\"${fileName}\"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error: any) {
    console.error("[QR Batch PDF] Error:", error)
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    )
  }
}

