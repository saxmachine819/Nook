import { NextRequest, NextResponse } from "next/server"
import { lookupQRAssetByToken } from "@/lib/qr-asset-utils"
import { generateQROnlySVG } from "@/lib/qr-sticker-generator"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const params = await context.params
    const token = params.token

    const qrAsset = await lookupQRAssetByToken(token)
    if (!qrAsset) {
      return new NextResponse("QR asset not found", { status: 404 })
    }

    const host =
      request.headers.get("host") ||
      process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, "") ||
      "localhost:3000"
    const protocol =
      request.headers.get("x-forwarded-proto") ||
      (host.includes("localhost") ? "http" : "https")
    const baseUrl = `${protocol}://${host}`
    const qrUrl = `${baseUrl}/q/${token}`

    const svg = await generateQROnlySVG({ qrUrl })

    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (error: unknown) {
    console.error("Error generating QR-only SVG:", error)
    return new NextResponse("Error generating QR", { status: 500 })
  }
}
