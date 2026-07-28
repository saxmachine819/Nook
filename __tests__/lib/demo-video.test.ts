import { afterEach, describe, expect, it } from "vitest"
import {
  getDefaultDemoVideoUrl,
  resolveDemoVideoUrl,
} from "@/lib/demo-video"

describe("resolveDemoVideoUrl", () => {
  const original = process.env.NEXT_PUBLIC_SUPABASE_URL

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = original
    }
  })

  it("builds the default MP4 from NEXT_PUBLIC_SUPABASE_URL when unset", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    expect(resolveDemoVideoUrl(undefined)).toBe(
      "https://example.supabase.co/storage/v1/object/public/public-assets/demo/nooc-demo.mp4"
    )
    expect(resolveDemoVideoUrl(null)).toBe(getDefaultDemoVideoUrl())
    expect(resolveDemoVideoUrl("")).toBe(getDefaultDemoVideoUrl())
  })

  it("ignores legacy QuickTime .mov URLs", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    expect(
      resolveDemoVideoUrl(
        "https://example.public.blob.vercel-storage.com/demo.mov"
      )
    ).toBe(getDefaultDemoVideoUrl())
    expect(
      resolveDemoVideoUrl(
        "https://example.public.blob.vercel-storage.com/demo.mov?download=1"
      )
    ).toBe(getDefaultDemoVideoUrl())
  })

  it("accepts https MP4 (and other non-mov) URLs", () => {
    const mp4 = "https://cdn.example.com/demo-video.mp4"
    expect(resolveDemoVideoUrl(mp4)).toBe(mp4)
  })
})
