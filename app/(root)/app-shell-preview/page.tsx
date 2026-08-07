import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "App shell preview — Nooc",
  description: "Visual preview of the Capacitor native shell chrome.",
  robots: { index: false, follow: false },
}

/**
 * Browser-visible mock of the native shell for QA / App Review screenshots
 * when a physical device build is not available in CI.
 */
export default function AppShellPreviewPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a332b] to-[#0b1f1a] px-4 py-10">
      <div className="mx-auto max-w-md text-center text-white/70 text-sm mb-6">
        <p className="font-semibold text-white">Native shell preview</p>
        <p className="mt-1">
          Capacitor chrome · shared web product ·{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy
          </Link>
        </p>
      </div>

      <div className="mx-auto w-full max-w-[390px] rounded-[42px] bg-black p-3.5 shadow-2xl">
        <div className="relative overflow-hidden rounded-[30px] bg-[#f3efe6]">
          <div className="absolute left-1/2 top-2 z-10 h-7 w-[126px] -translate-x-1/2 rounded-full bg-black" />
          <div className="flex h-[54px] items-center justify-between px-5 pt-4 text-xs font-bold text-[#12201b]">
            <span>9:41</span>
            <span>Nooc</span>
          </div>
          <div
            className="relative flex min-h-[520px] flex-col justify-end bg-cover bg-center px-5 pb-5 pt-16 text-white"
            style={{
              backgroundImage:
                "linear-gradient(180deg, rgba(11,31,26,0.2), rgba(11,31,26,0.78)), radial-gradient(120% 80% at 50% 20%, #3d8b6e, #0b1f1a)",
            }}
          >
            <span className="absolute right-3 top-16 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur">
              Native shell
            </span>
            <h1 className="text-4xl font-black tracking-tight">Nooc</h1>
            <p className="mt-2 max-w-xs text-sm text-white/85 leading-relaxed">
              Reserve calm workspaces by the hour — same product as the web, with
              push, offline bookings, and Sign in with Apple.
            </p>
            <Link
              href="/"
              className="mt-4 inline-flex w-fit rounded-full bg-white px-4 py-2.5 text-sm font-extrabold text-[#2f6f57]"
            >
              Explore nearby
            </Link>
          </div>
          <nav className="grid grid-cols-4 border-t border-black/5 bg-white/95 px-2 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-[#5c6b64]">
            <div className="text-[#2f6f57]">Explore</div>
            <div>Bookings</div>
            <div>Profile</div>
            <div>Manage</div>
          </nav>
        </div>
      </div>

      <div className="mx-auto mt-8 max-w-md space-y-2 text-center text-xs text-white/60">
        <p>
          Offline fallback lives at{" "}
          <code className="text-white/80">mobile/www/index.html</code>
        </p>
        <p>
          Store checklist:{" "}
          <Link href="/support" className="underline underline-offset-2">
            /support
          </Link>
        </p>
      </div>
    </div>
  )
}
