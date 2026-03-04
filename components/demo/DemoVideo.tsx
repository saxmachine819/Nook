"use client"

import { useEffect, useState } from "react"

const FALLBACK_DEMO_VIDEO_URL =
  "https://ustnxz2u6doufmes.public.blob.vercel-storage.com/2026-03-04_NoocDemo.mov"

export function DemoVideo() {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/demo-video-url")
      .then((res) => {
        if (!res.ok) return { url: null }
        return res.json() as Promise<{ url: string | null }>
      })
      .then((data) => {
        const apiUrl = data?.url ?? null
        if (apiUrl) {
          setUrl(apiUrl)
          return
        }
        // Local dev: fallback to file in public/ when API returns no URL
        if (typeof window !== "undefined" && window.location.hostname === "localhost") {
          setUrl("/demo-video.mov")
        } else {
          // Staging/production: use known blob URL when API returns null (env not in runtime)
          setUrl(FALLBACK_DEMO_VIDEO_URL)
        }
      })
      .catch(() => setUrl(null))
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
      src={url}
    >
      Your browser does not support the video tag.
    </video>
  )
}
