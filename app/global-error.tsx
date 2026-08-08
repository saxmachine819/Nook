"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
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
      </body>
    </html>
  )
}
