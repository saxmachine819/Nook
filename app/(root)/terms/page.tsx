import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Terms of Service — Nooc",
  description: "Terms for using Nooc to reserve workspaces.",
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <article className="container mx-auto max-w-2xl px-4 py-12">
        <p className="text-sm text-muted-foreground mb-2">
          <Link href="/" className="underline-offset-4 hover:underline">
            Home
          </Link>
          {" · "}
          <Link href="/privacy" className="underline-offset-4 hover:underline">
            Privacy
          </Link>
          {" · "}
          <Link href="/support" className="underline-offset-4 hover:underline">
            Support
          </Link>
        </p>
        <h1 className="text-3xl font-black tracking-tight mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: August 7, 2026</p>

        <p className="mb-4">
          By creating an account and using Nooc (website or mobile app), you agree
          to these terms.
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3">Reservations & payments</h2>
        <ul className="list-disc pl-5 space-y-2 mb-4">
          <li>All reservations are final.</li>
          <li>Unused time, early departures, and no-shows are not refundable.</li>
          <li>Prices are shown before booking and may vary by venue.</li>
          <li>
            Payments for physical workspace seats are processed by Stripe (including
            Apple Pay where available). These are not digital goods subject to in-app
            purchase.
          </li>
        </ul>

        <h2 className="text-xl font-bold mt-8 mb-3">If a reserved seat is occupied</h2>
        <ul className="list-disc pl-5 space-y-2 mb-4">
          <li>Notify venue staff immediately. Do not confront other patrons.</li>
          <li>
            Venues should make reasonable efforts to resolve the issue or provide a
            comparable seat.
          </li>
          <li>
            If unresolved, report it to Nooc. Refunds or credits are not guaranteed
            and are handled case-by-case.
          </li>
        </ul>

        <h2 className="text-xl font-bold mt-8 mb-3">Venue expectations</h2>
        <p className="mb-4">
          Venues should clearly identify Nooc seats and honor reservations. Nooc
          does not control venue staff or operations.
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3">User expectations</h2>
        <p className="mb-2">You agree to:</p>
        <ul className="list-disc pl-5 space-y-2 mb-4">
          <li>Arrive on time and respect reservation times</li>
          <li>Use only your assigned seat</li>
          <li>Follow venue rules and behave respectfully</li>
          <li>Leave promptly when your reservation ends</li>
        </ul>
        <p className="mb-4">
          Misuse or repeated issues may result in account suspension or removal.
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3">Platform disclaimer</h2>
        <p className="mb-4">
          Nooc facilitates reservations but does not own or operate venues. Nooc is
          not responsible for lost items, venue disputes, or seating issues beyond
          reasonable review.
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3">Account deletion</h2>
        <p className="mb-4">
          You may delete your account anytime from Profile in the app or website.
          See also our{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            Privacy Policy
          </Link>
          .
        </p>

        <p className="text-sm text-muted-foreground mt-8">
          Questions?{" "}
          <a href="mailto:support@nooc.io" className="underline underline-offset-4">
            support@nooc.io
          </a>
        </p>
      </article>
    </div>
  )
}
