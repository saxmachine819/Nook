import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getQRBaseUrl } from "@/lib/qr-asset-utils"
import { isAdmin } from "@/lib/venue-auth"
import { generateQRStickerSVG } from "@/lib/qr-sticker-generator"
import PDFDocument from "pdfkit"
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SVGtoPDF = require("svg-to-pdfkit")

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null
  const n = Number.parseInt(value, 10)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

async function renderPdfBuffer(opts: {
  svgs: string[]
  fileName: string
}): Promise<Buffer> {
  const { svgs } = opts

  // A4 in points (pt)
  const pageWidth = 595
  const pageHeight = 842
  const margin = 24
  const gap = 12

  // Determine sticker aspect ratio from first SVG (they're deterministic)
  const first = svgs[0]
  const widthMatch = first.match(/width=\"(\d+(?:\.\d+)?)\"/)
  const heightMatch = first.match(/height=\"(\d+(?:\.\d+)?)\"/)
  const svgW = widthMatch ? Number(widthMatch[1]) : 400
  const svgH = heightMatch ? Number(heightMatch[1]) : 500
  const aspect = svgH / svgW

  // Choose a target sticker width that fits a reasonable grid on A4.
  // We'll compute columns based on available width.
  const maxStickerW = 250 // tweakable; safe for scan + margins
  const usableW = pageWidth - margin * 2
  const usableH = pageHeight - margin * 2

  const cols = Math.max(
    1,
    Math.floor((usableW + gap) / (maxStickerW + gap))
  )
  const stickerW = Math.floor((usableW - gap * (cols - 1)) / cols)
  const stickerH = Math.floor(stickerW * aspect)
  const rows = Math.max(1, Math.floor((usableH + gap) / (stickerH + gap)))

  const perPage = cols * rows

  const doc = new PDFDocument({
    size: [pageWidth, pageHeight],
    margin: 0, // we manage margins ourselves
    autoFirstPage: true,
    compress: true,
  })

  const chunks: Buffer[] = []
  doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)
  })

  // Render each SVG in grid order.
  svgs.forEach((svg, i) => {
    const pageIndex = Math.floor(i / perPage)
    const idxInPage = i % perPage

    if (idxInPage === 0 && pageIndex > 0) {
      doc.addPage({ size: [pageWidth, pageHeight], margin: 0 })
    }

    const r = Math.floor(idxInPage / cols)
    const c = idxInPage % cols

    const x = margin + c * (stickerW + gap)
    const y = margin + r * (stickerH + gap)

    SVGtoPDF(doc, svg, x, y, {
      width: stickerW,
      height: stickerH,
      preserveAspectRatio: "xMidYMid meet",
    })
  })

  doc.end()
  return await done
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
    const pdfBuffer = await renderPdfBuffer({ svgs, fileName })

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

