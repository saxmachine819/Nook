"use client"

import { useEffect } from "react"

// #region agent log
function logError(location: string, message: string, data: Record<string, unknown>) {
  fetch("http://127.0.0.1:7242/ingest/b5111244-c4ed-4ea6-9398-28181fe79047", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location,
      message,
      data,
      timestamp: Date.now(),
      sessionId: "debug-session",
      hypothesisId: "H1-H2",
    }),
  }).catch(() => {})
}
// #endregion

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // #region agent log
    logError("app/error.tsx:render", "Error boundary caught", {
      errorMessage: error?.message,
      errorName: error?.name,
      digest: error?.digest,
      stack: error?.stack?.slice(0, 500),
    })
    // #endregion
  }, [error])

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-6">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="max-w-md text-center text-sm text-muted-foreground">{error?.message ?? "Unknown error"}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Try again
      </button>
    </div>
  )
}
