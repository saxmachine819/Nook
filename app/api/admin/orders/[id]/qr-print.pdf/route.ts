import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getQRBaseUrl } from "@/lib/qr-asset-utils"
import { isAdmin } from "@/lib/venue-auth"
import { generateQROnlySVG } from "@/lib/qr-sticker-generator"
import { renderQrPagesPdf } from "@/lib/pdf-qr-grid"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 })
    }
    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { id: orderId } = await context.params
    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 })
    }

    const order = await prisma.signageOrder.findUnique({
      where: { id: orderId },
      include: {
        venue: { select: { name: true, address: true, city: true, state: true, zipCode: true } },
        items: {
          include: { qrAsset: { select: { token: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    if (order.items.length === 0) {
      return NextResponse.json(
        { error: "Order has no line items" },
        { status: 400 }
      )
    }

    const baseUrl = getQRBaseUrl(request)
    const svgs = await Promise.all(
      order.items.map((item) =>
        generateQROnlySVG({
          qrUrl: `${baseUrl}/q/${item.qrAsset.token}`,
        })
      )
    )
    const labels = order.items.map((item) => item.label)

    const venueAddress = [
      order.venue.address,
      [order.venue.city, order.venue.state, order.venue.zipCode].filter(Boolean).join(", "),
    ]
      .filter(Boolean)
      .join("\n")

    const pdfBuffer = await renderQrPagesPdf(svgs, labels, {
      orderNumber: orderId,
      venueName: order.venue.name,
      venueAddress: venueAddress || "—",
    })
    const fileName = `order-${orderId}-qr-codes.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    console.error("[Order QR Print PDF] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to generate PDF",
        detail: message,
        ...(process.env.NODE_ENV === "development" && stack && { stack }),
      },
      { status: 500 }
    )
  }
}
