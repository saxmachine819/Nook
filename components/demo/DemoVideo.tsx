"use client"

import { useEffect, useRef, useState } from "react"

const FALLBACK_DEMO_VIDEO_URL =
  "https://ustnxz2u6doufmes.public.blob.vercel-storage.com/2026-03-05_NoocDemo.mov"

export function DemoVideo() {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [poster, setPoster] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

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

  const handleLoadedData = () => {
    const video = videoRef.current
    if (!video || poster) return

    try {
      const canvas = document.createElement("canvas")
      const width = video.videoWidth
      const height = video.videoHeight
      if (!width || !height) return

      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      ctx.drawImage(video, 0, 0, width, height)
      const dataUrl = canvas.toDataURL("image/jpeg")
      setPoster(dataUrl)
    } catch {
      // Ignore errors (e.g. cross-origin restrictions)
    }
  }

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
      ref={videoRef}
      className="w-full h-full object-contain"
      controls
      playsInline
      preload="metadata"
      crossOrigin="anonymous"
      src={url}
      poster={poster ?? undefined}
      onLoadedData={handleLoadedData}
    >
      Your browser does not support the video tag.
    </video>
  )
}
