"use client"

import { Card, CardContent } from "@/components/ui/card"

const STEPS = [
  {
    title: "Add your venue info",
    blurb:
      "Tell us the basics: name, address, hours, and any quick rules guests should know. You can edit everything later.",
  },
  {
    title: "Build your inventory",
    blurb:
      "Choose which seats or tables are reservable, how many people they fit, and when they're available.",
  },
  {
    title: "Connect Stripe",
    blurb: "Connect Stripe so payouts can be deposited automatically and securely.",
  },
  {
    title: "Submit for approval",
    blurb:
      "We'll quickly review your setup to make sure it's clear and ready for guests. We'll email you once you're live.",
  },
  {
    title: "Manage bookings & payouts",
    blurb:
      "Use your dashboard to view reservations, track earnings, adjust availability, and see payout history.",
  },
]

const GOOD_TO_KNOW = [
  "You can pause or change availability anytime",
  "You choose pricing and what's reservable",
  "Nooc is designed to complement normal café traffic",
  "Need help? support@nooc.io",
]

export function WelcomeOnboardStep() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Welcome to Nooc 👋
        </h2>
        <p className="mt-1.5 text-muted-foreground">
          Let's get your space ready for reservations.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Nooc helps people reserve a seat or table to work — and helps venues
            earn passive, predictable revenue. The setup takes just a
            few minutes. We'll guide you step by step.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {STEPS.map((step, i) => (
          <Card key={i}>
            <CardContent className="flex gap-4 pt-6">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                {i + 1}
              </span>
              <div>
                <h3 className="font-medium">{step.title}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {step.blurb}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <h3 className="mb-3 text-sm font-medium">Good to know</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            {GOOD_TO_KNOW.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

    </div>
  )
}
