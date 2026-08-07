import type { Metadata } from "next"
import Link from "next/link"
import { Mail, HelpCircle, Trash2, Shield } from "lucide-react"

export const metadata: Metadata = {
  title: "Support — Nooc",
  description: "Get help with Nooc bookings, venues, and your account.",
}

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-xl px-4 py-12">
        <p className="text-sm text-muted-foreground mb-6">
          <Link href="/" className="underline-offset-4 hover:underline">
            Home
          </Link>
        </p>
        <div className="flex items-center gap-3 mb-2">
          <HelpCircle className="h-8 w-8 text-primary/60" />
          <h1 className="text-3xl font-black tracking-tight">Support</h1>
        </div>
        <p className="text-muted-foreground mb-10">
          We&apos;re here to help with bookings, venues, and your account.
        </p>

        <div className="space-y-4">
          <a
            href="mailto:support@nooc.io"
            className="flex items-center gap-4 rounded-[1.5rem] bg-white p-5 shadow-md ring-1 ring-black/5 transition hover:shadow-lg"
          >
            <Mail className="h-6 w-6 text-primary" />
            <div>
              <p className="font-bold">Email support</p>
              <p className="text-sm text-muted-foreground">support@nooc.io</p>
            </div>
          </a>

          <Link
            href="/privacy"
            className="flex items-center gap-4 rounded-[1.5rem] bg-white p-5 shadow-md ring-1 ring-black/5 transition hover:shadow-lg"
          >
            <Shield className="h-6 w-6 text-primary" />
            <div>
              <p className="font-bold">Privacy Policy</p>
              <p className="text-sm text-muted-foreground">
                How we handle your data
              </p>
            </div>
          </Link>

          <Link
            href="/profile"
            className="flex items-center gap-4 rounded-[1.5rem] bg-white p-5 shadow-md ring-1 ring-black/5 transition hover:shadow-lg"
          >
            <Trash2 className="h-6 w-6 text-primary" />
            <div>
              <p className="font-bold">Delete your account</p>
              <p className="text-sm text-muted-foreground">
                Profile → Delete account (type DELETE to confirm)
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
