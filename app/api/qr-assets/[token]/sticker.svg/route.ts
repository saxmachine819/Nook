import { NextRequest, NextResponse } from "next/server"
import { getQRBaseUrl, lookupQRAssetByToken } from "@/lib/qr-asset-utils"
import { generateQRStickerSVG } from "@/lib/qr-sticker-generator"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const params = await context.params
    const token = params.token

    // Look up QR asset
    const qrAsset = await lookupQRAssetByToken(token)
    if (!qrAsset) {
      return new NextResponse("QR asset not found", { status: 404 })
    }

    const baseUrl = getQRBaseUrl(request)
    const qrUrl = `${baseUrl}/q/${token}`

    // Generate sticker SVG
    const svg = await generateQRStickerSVG({
      token,
      qrUrl,
    })

    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=31536000, immutable", // Cache for 1 year
      },
    })
  } catch (error: any) {
    console.error("Error generating QR sticker:", error)
    return new NextResponse("Error generating sticker", { status: 500 })
  }
}
