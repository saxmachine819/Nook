import fs from "fs"
import path from "path"

/**
 * Loads the Nook logo from the project root and converts it to a base64 data URI.
 * Returns null if the logo file is not found.
 */
export function getLogoDataUri(): string | null {
  try {
    // Prefer newer logo if present, fallback to original.
    const preferred = path.join(process.cwd(), "NookLogo1.png")
    const fallback = path.join(process.cwd(), "NookLogo.png")
    const logoPath = fs.existsSync(preferred) ? preferred : fallback

    if (!fs.existsSync(logoPath)) {
      console.warn("NookLogo1.png/NookLogo.png not found, using placeholder")
      return null // TODO: Create placeholder
    }

    const logoBuffer = fs.readFileSync(logoPath)
    const base64 = logoBuffer.toString("base64")
    return `data:image/png;base64,${base64}`
  } catch (error) {
    console.error("Error loading logo:", error)
    return null
  }
}
