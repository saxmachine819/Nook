import PDFDocument from "pdfkit"
// eslint-disable-next-line -- require() used for svg-to-pdfkit CJS compatibility
const SVGtoPDF = require("svg-to-pdfkit")

/**
 * Renders an array of QR SVGs into a single PDF with a grid layout on A4 pages.
 * Used by batch print and order QR print endpoints.
 */
export async function renderQrGridPdf(svgs: string[]): Promise<Buffer> {
  if (svgs.length === 0) {
    throw new Error("At least one SVG is required")
  }

  // A4 in points (pt)
  const pageWidth = 595
  const pageHeight = 842
  const margin = 24
  const gap = 12

  // Determine sticker aspect ratio from first SVG (they're deterministic)
  const first = svgs[0]!
  const widthMatch = first.match(/width="(\d+(?:\.\d+)?)"/)
  const heightMatch = first.match(/height="(\d+(?:\.\d+)?)"/)
  const svgW = widthMatch ? Number(widthMatch[1]) : 400
  const svgH = heightMatch ? Number(heightMatch[1]) : 500
  const aspect = svgH / svgW

  // Choose a target sticker width that fits a reasonable grid on A4.
  const maxStickerW = 250
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
    margin: 0,
    autoFirstPage: true,
    compress: true,
  })

  const chunks: Buffer[] = []
  doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)
  })

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

/** A4 in points */
const A4_W = 595
const A4_H = 842

export type TitleSheetOptions = {
  orderNumber: string
  venueName: string
  venueAddress: string
}

/**
 * Renders one QR per page with a small label below (e.g. "Counter Sign", "Table: A", "Seat: 1 — Table B").
 * For designer handoff: QR only (no sticker text), one per page, with descriptive label.
 * Optional title sheet as first page with order number, venue name, and address.
 */
export async function renderQrPagesPdf(
  svgs: string[],
  labels: string[],
  titleSheet?: TitleSheetOptions
): Promise<Buffer> {
  if (svgs.length === 0) {
    throw new Error("At least one SVG is required")
  }
  if (svgs.length !== labels.length) {
    throw new Error("svgs and labels must have the same length")
  }

  const margin = 40
  const labelHeight = 24
  const gapBetweenQrAndLabel = 16

  const first = svgs[0]!
  const widthMatch = first.match(/width="(\d+(?:\.\d+)?)"/)
  const heightMatch = first.match(/height="(\d+(?:\.\d+)?)"/)
  const svgW = widthMatch ? Number(widthMatch[1]) : 368
  const svgH = heightMatch ? Number(heightMatch[1]) : 368

  const usableW = A4_W - margin * 2
  const usableH = A4_H - margin * 2 - labelHeight - gapBetweenQrAndLabel
  const scale = Math.min(usableW / svgW, usableH / svgH, 1)
  const qrW = svgW * scale
  const qrH = svgH * scale
  const x = margin + (usableW - qrW) / 2
  const y = margin

  const doc = new PDFDocument({
    size: [A4_W, A4_H],
    margin: 0,
    autoFirstPage: true,
    compress: true,
  })

  const chunks: Buffer[] = []
  doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)
  })

  if (titleSheet) {
    const titleMargin = 60
    const lineHeight = 22
    doc
      .fontSize(10)
      .fillColor("#666666")
      .text("Order", titleMargin, titleMargin + 80, { align: "center", width: A4_W - titleMargin * 2 })
    doc
      .fontSize(18)
      .fillColor("#111111")
      .text(titleSheet.orderNumber, titleMargin, titleMargin + 80 + lineHeight, { align: "center", width: A4_W - titleMargin * 2 })
    doc
      .fontSize(10)
      .fillColor("#666666")
      .text("Venue", titleMargin, titleMargin + 80 + lineHeight * 3, { align: "center", width: A4_W - titleMargin * 2 })
    doc
      .fontSize(14)
      .fillColor("#111111")
      .text(titleSheet.venueName, titleMargin, titleMargin + 80 + lineHeight * 4, { align: "center", width: A4_W - titleMargin * 2 })
    doc
      .fontSize(10)
      .fillColor("#666666")
      .text("Address", titleMargin, titleMargin + 80 + lineHeight * 6, { align: "center", width: A4_W - titleMargin * 2 })
    doc
      .fontSize(12)
      .fillColor("#333333")
      .text(titleSheet.venueAddress, titleMargin, titleMargin + 80 + lineHeight * 7, { align: "center", width: A4_W - titleMargin * 2 })
    doc.addPage({ size: [A4_W, A4_H], margin: 0 })
  }

  svgs.forEach((svg, i) => {
    if (i > 0) {
      doc.addPage({ size: [A4_W, A4_H], margin: 0 })
    }

    SVGtoPDF(doc, svg, x, y, {
      width: qrW,
      height: qrH,
      preserveAspectRatio: "xMidYMid meet",
    })

    const labelY = margin + qrH + gapBetweenQrAndLabel
    doc
      .fontSize(11)
      .fillColor("#333333")
      .text(labels[i] ?? "", margin, labelY, {
        width: A4_W - margin * 2,
        align: "center",
      })
  })

  doc.end()
  return await done
}
