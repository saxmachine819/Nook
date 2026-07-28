/**
 * Canonical demo video path.
 * Served from `public/demo-video.mp4` (H.264/AAC, moov at front) so production
 * does not depend on a separate CDN bucket existing in each Supabase project.
 */
export const DEFAULT_DEMO_VIDEO_URL = "/demo-video.mp4"

/** Prefer env when it is an http(s) URL that is not a legacy QuickTime .mov. */
export function resolveDemoVideoUrl(raw?: string | null): string {
  const trimmed = raw?.trim()
  if (trimmed?.startsWith("http") && !/\.mov(\?|#|$)/i.test(trimmed)) {
    return trimmed
  }
  // Also accept an explicit same-origin override if someone sets it.
  if (trimmed?.startsWith("/") && !/\.mov(\?|#|$)/i.test(trimmed)) {
    return trimmed
  }
  return DEFAULT_DEMO_VIDEO_URL
}
