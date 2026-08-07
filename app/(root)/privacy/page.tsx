import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privacy Policy — Nooc",
  description: "How Nooc collects, uses, and protects your information.",
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <article className="container mx-auto max-w-2xl px-4 py-12 prose prose-neutral">
        <p className="text-sm text-muted-foreground mb-2">
          <Link href="/" className="underline-offset-4 hover:underline">
            Home
          </Link>
          {" · "}
          <Link href="/terms" className="underline-offset-4 hover:underline">
            Terms
          </Link>
          {" · "}
          <Link href="/support" className="underline-offset-4 hover:underline">
            Support
          </Link>
        </p>
        <h1 className="text-3xl font-black tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: August 7, 2026</p>

        <p>
          Nooc (&quot;we&quot;, &quot;us&quot;) operates the Nooc website and mobile
          applications that help people reserve calm workspaces by the hour. This
          policy explains what we collect and why.
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3">Information we collect</h2>
        <ul className="list-disc pl-5 space-y-2 mb-4">
          <li>
            <strong>Account data</strong> — name, email, and profile image from
            sign-in providers (Google, Apple, or email magic link).
          </li>
          <li>
            <strong>Booking data</strong> — reservation times, venue, seat/table,
            payment status, and related messages.
          </li>
          <li>
            <strong>Payment data</strong> — processed by Stripe. We do not store
            full card numbers. Connected venues receive payouts via Stripe Connect.
          </li>
          <li>
            <strong>Device data (app)</strong> — push notification tokens, app
            version, and optional biometrics preference stored on-device.
          </li>
          <li>
            <strong>Location (optional)</strong> — used to show nearby venues on
            the explore map when you grant permission.
          </li>
          <li>
            <strong>Diagnostics</strong> — crash and error reports (e.g. Sentry)
            when enabled.
          </li>
        </ul>

        <h2 className="text-xl font-bold mt-8 mb-3">How we use information</h2>
        <ul className="list-disc pl-5 space-y-2 mb-4">
          <li>Create and manage your account and reservations</li>
          <li>Process payments and send booking confirmations and reminders</li>
          <li>Notify venues of new or canceled bookings</li>
          <li>Send push notifications for booking reminders when enabled</li>
          <li>Improve reliability and prevent abuse</li>
        </ul>

        <h2 className="text-xl font-bold mt-8 mb-3">Sharing</h2>
        <p className="mb-4">
          We share data with service providers who help us operate Nooc (Stripe,
          email delivery, hosting, maps, crash reporting). Venue operators see
          booking details needed to honor your reservation. We do not sell personal
          information.
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3">Retention & deletion</h2>
        <p className="mb-4">
          You can delete your account in Profile → Delete account (or contact{" "}
          <a href="mailto:support@nooc.io">support@nooc.io</a>). Deletion cancels
          future reservations, pauses owned venues, and anonymizes your account
          record.
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3">Children</h2>
        <p className="mb-4">
          Nooc is not directed at children under 13. We do not knowingly collect
          their personal information.
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3">Contact</h2>
        <p>
          Questions:{" "}
          <a href="mailto:support@nooc.io">support@nooc.io</a> ·{" "}
          <Link href="/support">Support</Link>
        </p>
      </article>
    </div>
  )
}
