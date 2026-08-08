import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "App shell preview — Nooc",
  description:
    "Capacitor loads the same mobile website — this preview embeds the live UI.",
  robots: { index: false, follow: false },
}

/**
 * Preview of what the native app shows: the real mobile website inside a
 * device frame. No alternate design — product UI is shared with the web.
 */
export default function AppShellPreviewPage() {
  return (
    <div className="min-h-screen bg-neutral-900 px-4 py-8">
      <div className="mx-auto mb-6 max-w-md text-center text-sm text-white/70">
        <p className="font-semibold text-white">Same UI as the mobile website</p>
        <p className="mt-1">
          Capacitor WebView loads Nooc directly — not a redesigned app.{" "}
          <Link href="/" className="underline underline-offset-2">
            Open site
          </Link>
        </p>
      </div>

      <div className="mx-auto w-full max-w-[390px] rounded-[42px] bg-black p-3 shadow-2xl">
        <div className="relative overflow-hidden rounded-[32px] bg-background">
          <div className="pointer-events-none absolute left-1/2 top-2 z-10 h-7 w-[120px] -translate-x-1/2 rounded-full bg-black" />
          <iframe
            title="Nooc mobile website"
            src="/"
            className="h-[720px] w-full border-0 bg-background"
          />
        </div>
      </div>

      <p className="mx-auto mt-6 max-w-md text-center text-xs text-white/50">
        Offline-only fallback: <code className="text-white/70">mobile/www/index.html</code>
        {" · "}
        <Link href="/support" className="underline underline-offset-2">
          Support
        </Link>
      </p>
    </div>
  )
}
