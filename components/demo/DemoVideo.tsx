"use client"

import { useEffect, useState } from "react"

export function DemoVideo() {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/demo-video-url")
      .then((res) => res.json())
      .then((data: { url: string | null }) => {
        setUrl(data.url ?? null)
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
