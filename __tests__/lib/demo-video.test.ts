import { describe, expect, it } from "vitest"
import {
  DEFAULT_DEMO_VIDEO_URL,
  resolveDemoVideoUrl,
} from "@/lib/demo-video"

describe("resolveDemoVideoUrl", () => {
  it("returns the same-origin MP4 when unset", () => {
    expect(resolveDemoVideoUrl(undefined)).toBe(DEFAULT_DEMO_VIDEO_URL)
    expect(resolveDemoVideoUrl(null)).toBe(DEFAULT_DEMO_VIDEO_URL)
    expect(resolveDemoVideoUrl("")).toBe(DEFAULT_DEMO_VIDEO_URL)
    expect(DEFAULT_DEMO_VIDEO_URL).toBe("/demo-video.mp4")
  })

  it("ignores legacy QuickTime .mov URLs", () => {
    expect(
      resolveDemoVideoUrl(
        "https://example.public.blob.vercel-storage.com/demo.mov"
      )
    ).toBe(DEFAULT_DEMO_VIDEO_URL)
    expect(
      resolveDemoVideoUrl(
        "https://example.public.blob.vercel-storage.com/demo.mov?download=1"
      )
    ).toBe(DEFAULT_DEMO_VIDEO_URL)
  })

  it("accepts https MP4 (and other non-mov) URLs", () => {
    const mp4 = "https://cdn.example.com/demo-video.mp4"
    expect(resolveDemoVideoUrl(mp4)).toBe(mp4)
  })

  it("accepts same-origin non-mov paths", () => {
    expect(resolveDemoVideoUrl("/custom-demo.mp4")).toBe("/custom-demo.mp4")
  })
})
