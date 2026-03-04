import { NextResponse } from "next/server"

/**
 * Returns the demo video URL from env at request time (no build-time inlining).
 * Used by /demo so the video works on staging/production even when
 * NEXT_PUBLIC_DEMO_VIDEO_URL was added after the last build.
 */
export async function GET() {
  const raw = process.env.NEXT_PUBLIC_DEMO_VIDEO_URL?.trim()
  const url = raw?.startsWith("http") ? raw : null
  return NextResponse.json({ url })
}
