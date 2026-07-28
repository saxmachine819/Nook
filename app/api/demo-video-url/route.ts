import { NextResponse } from "next/server"
import {
  DEFAULT_DEMO_VIDEO_URL,
  resolveDemoVideoUrl,
} from "@/lib/demo-video"

/**
 * Returns the demo video URL from env at request time (no build-time inlining).
 * Used by /demo so the video works on staging/production even when
 * DEMO_VIDEO_URL / NEXT_PUBLIC_DEMO_VIDEO_URL was added after the last build.
 *
 * Legacy QuickTime .mov URLs are ignored in favor of the canonical MP4 —
 * .mov often fails to play in Chrome/Firefox on the hosted site.
 */
export const dynamic = "force-dynamic"

export async function GET() {
  const raw =
    process.env.DEMO_VIDEO_URL ?? process.env.NEXT_PUBLIC_DEMO_VIDEO_URL
  const url = resolveDemoVideoUrl(raw)
  return NextResponse.json({
    url,
    usingDefault: url === DEFAULT_DEMO_VIDEO_URL,
  })
}
