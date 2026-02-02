"use client"

import * as Sentry from "@sentry/nextjs"
import { useState } from "react"

/**
 * Sentry verification page. Visit /sentry-example-page and click the button
 * to send a test error to Sentry. Check your Sentry project → Issues to confirm.
 */
export default function SentryExamplePage() {
  const [sent, setSent] = useState(false)

  function sendTestErrorToSentry() {
    const err = new Error("Sentry Test Error — verification from /sentry-example-page")
    Sentry.captureException(err)
    setSent(true)
  }

  function triggerUncaughtError() {
    // Intentionally triggers uncaught error so Sentry's global handler catches it.
    // @ts-expect-error — intentional for verification
    myUndefinedFunction()
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <h1 className="text-xl font-semibold">Sentry test page</h1>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        Click a button to send a test error to Sentry. Check your Sentry project → Issues to confirm.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={sendTestErrorToSentry}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Send test error to Sentry
        </button>
        <button
          type="button"
          onClick={triggerUncaughtError}
          className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Trigger uncaught error
        </button>
      </div>
      {sent && (
        <p className="text-sm text-green-600 dark:text-green-400">
          Test error sent. Check Sentry → Issues.
        </p>
      )}
    </div>
  )
}
