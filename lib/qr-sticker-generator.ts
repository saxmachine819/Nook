import QRCode from "qrcode"
import { getLogoDataUri } from "./qr-logo-utils"

interface StickerOptions {
  token: string
  qrUrl: string
  logoSize?: number
  qrSize?: number
  quietZone?: number
}

/**
 * Generates a print-ready QR code sticker SVG with embedded logo.
 * 
 * Layout:
 * - Top text: "This seat is reserved for Nook"
 * - Center: QR code with logo overlay
 * - Bottom text: "Scan here to book"
 * 
 * Uses high error correction level (H) to allow logo overlay without breaking scan reliability.
 */
export async function generateQRStickerSVG(options: StickerOptions): Promise<string> {
  const {
    token,
    qrUrl,
    logoSize = 102,
    qrSize = 300,
    quietZone = 24,
  } = options

  // Brand colors
  const brandGreen = "#0F5132"
  const white = "#FFFFFF"

  // Generate QR code SVG with high error correction - inverted colors (white on dark)
  const qrSvg = await QRCode.toString(qrUrl, {
    type: "svg",
    errorCorrectionLevel: "H", // High error correction for logo
    margin: 1, // Quiet zone
    width: qrSize,
    color: {
      dark: white, // White modules
      light: brandGreen, // Dark green background
    },
  })

  // Extract QR code SVG content (remove XML declaration if present)
  const qrContent = qrSvg.replace(/^<\?xml[^>]*\?>/, "").trim()

  // Get logo data URI
  const logoDataUri = getLogoDataUri()

  // Calculate dimensions with padding
  const padding = 16
  const textTopHeight = 60
  const textBottomHeight = 30
  const stickerWidth = qrSize + quietZone * 2 + padding * 2
  const stickerHeight = textTopHeight + qrSize + quietZone * 2 + textBottomHeight + padding * 2

  // Logo background size (slightly larger than logo)
  const logoBgSize = logoSize + 8

  // Build SVG with dark green background
  const svg = `
<svg width="${stickerWidth}" height="${stickerHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .text-top { 
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; 
        font-size: 27px; 
        font-weight: 600; 
        fill: ${white}; 
        text-anchor: middle;
        letter-spacing: -0.01em;
      }
      .text-bottom { 
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; 
        font-size: 27px; 
        font-weight: 600; 
        fill: ${white}; 
        text-anchor: middle;
        letter-spacing: 0.01em;
      }
      .logo-text {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: 22px;
        font-weight: 700;
        fill: ${white};
        text-anchor: middle;
      }
    </style>
  </defs>
  
  <!-- Dark green background -->
  <rect width="${stickerWidth}" height="${stickerHeight}" fill="${brandGreen}" rx="8"/>
  
  <!-- Top text -->
  <text x="${stickerWidth / 2}" y="${padding + 36}" class="text-top">This seat is reserved for Nook</text>
  
  <!-- QR code container -->
  <g transform="translate(${padding + quietZone}, ${padding + textTopHeight + quietZone})">
    ${qrContent}
    ${logoDataUri ? `
    <!-- Logo background - green (match site) -->
    <rect x="${qrSize / 2 - logoBgSize / 2}" y="${qrSize / 2 - logoBgSize / 2}" 
          width="${logoBgSize}" height="${logoBgSize}" 
          rx="14" fill="${brandGreen}" stroke="${white}" stroke-width="2"/>
    <!-- Logo image -->
    <image href="${logoDataUri}" 
           x="${qrSize / 2 - logoSize / 2}" 
           y="${qrSize / 2 - logoSize / 2}" 
           width="${logoSize}" 
           height="${logoSize}"
           preserveAspectRatio="xMidYMid meet"/>
    ` : `
    <!-- Logo placeholder - rounded square -->
    <rect x="${qrSize / 2 - logoBgSize / 2}" y="${qrSize / 2 - logoBgSize / 2}" 
          width="${logoBgSize}" height="${logoBgSize}" 
          rx="14" fill="${brandGreen}" stroke="${white}" stroke-width="2"/>
    <text x="${qrSize / 2}" y="${qrSize / 2 + 6}" class="logo-text">NOOK</text>
    `}
  </g>
  
  <!-- Bottom text -->
  <text x="${stickerWidth / 2}" y="${padding + textTopHeight + quietZone * 2 + qrSize + 18}" class="text-bottom">Scan here to book</text>
</svg>
  `.trim()

  return svg
}
