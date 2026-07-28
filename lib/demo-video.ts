const DEMO_VIDEO_OBJECT_PATH =
  "/storage/v1/object/public/public-assets/demo/nooc-demo.mp4"

/** Canonical web-friendly demo video (H.264/AAC MP4, moov at front). */
export function getDefaultDemoVideoUrl(): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")
  if (!base) {
    // Relative same-origin fallback if public env is missing at build time.
    // Prefer setting NEXT_PUBLIC_SUPABASE_URL in Vercel.
    return ""
  }
  return `${base}${DEMO_VIDEO_OBJECT_PATH}`
}

/** Prefer env when it is an http(s) URL that is not a legacy QuickTime .mov. */
export function resolveDemoVideoUrl(raw?: string | null): string {
  const trimmed = raw?.trim()
  if (trimmed?.startsWith("http") && !/\.mov(\?|#|$)/i.test(trimmed)) {
    return trimmed
  }
  return getDefaultDemoVideoUrl()
}
