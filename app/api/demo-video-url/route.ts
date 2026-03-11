import { NextResponse } from "next/server"

/**
 * Returns the demo video URL from env at request time (no build-time inlining).
 * Used by /demo so the video works on staging/production even when
 * NEXT_PUBLIC_DEMO_VIDEO_URL was added after the last build.
 */
export const dynamic = "force-dynamic"

export async function GET() {
  // Prefer server-only var (never inlined); fallback to NEXT_PUBLIC_ for backwards compatibility
  const raw = (
    process.env.DEMO_VIDEO_URL ??
    process.env.NEXT_PUBLIC_DEMO_VIDEO_URL
  )?.trim()
  const url = raw?.startsWith("http") ? raw : null
  return NextResponse.json({ url })
}
