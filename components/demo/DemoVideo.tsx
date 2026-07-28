"use client"

import { useEffect, useState } from "react"
import {
  getDefaultDemoVideoUrl,
  resolveDemoVideoUrl,
} from "@/lib/demo-video"

const DEMO_VIDEO_POSTER_URL =
  "https://ustnxz2u6doufmes.public.blob.vercel-storage.com/Nooc_1080.png"

export function DemoVideo() {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/demo-video-url")
      .then((res) => {
        if (!res.ok) return { url: null as string | null }
        return res.json() as Promise<{ url: string | null }>
      })
      .then((data) => {
        const resolved = resolveDemoVideoUrl(data?.url)
        setUrl(resolved || null)
      })
      .catch(() => {
        const fallback = getDefaultDemoVideoUrl()
        setUrl(fallback || null)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <p className="text-muted-foreground font-medium">Loading...</p>
      </div>
    )
  }

  if (!url) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <p className="text-muted-foreground font-medium">Video coming soon</p>
      </div>
    )
  }

  return (
    <video
      className="w-full h-full object-contain"
      controls
      playsInline
      preload="metadata"
      poster={DEMO_VIDEO_POSTER_URL}
      src={url}
    >
      <source src={url} type="video/mp4" />
      Your browser does not support the video tag.
    </video>
  )
}
