import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Calendar, Coffee } from "lucide-react"

export const metadata = {
  title: "See how Nooc works | Nooc",
  description:
    "Reserve seats by the hour. Set your own pricing. Get paid. See how Nooc works for your shop.",
}

const CAL_EMBED_URL = "https://cal.com/jordan-cohen-3zchhq?embed=true"

export default function DemoPage() {
  // Optional: set NEXT_PUBLIC_DEMO_PHONE in .env for a real number
  const demoPhone = process.env.NEXT_PUBLIC_DEMO_PHONE ?? null

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.06),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,hsl(var(--primary)/0.06),transparent_50%)]" />

      <div className="container relative mx-auto max-w-3xl px-4 py-12 sm:py-16">
        {/* Hero */}
        <header className="text-center space-y-4 mb-12">
          <h1 className="text-4xl font-black tracking-tight text-primary sm:text-5xl">
            See how Nooc works for your shop
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Reserve seats by the hour. Set your own pricing. Get paid.
          </p>
        </header>

        {/* Video placeholder */}
        <section className="mb-14">
          <div className="aspect-video w-full max-w-3xl mx-auto rounded-2xl overflow-hidden bg-muted border border-border flex items-center justify-center">
            <p className="text-muted-foreground font-medium">Video coming soon</p>
          </div>
        </section>

        {/* CTAs */}
        <div className="space-y-14">
          {/* Schedule a meeting - Cal.com embed */}
          <section>
            <h2 className="text-xl font-black tracking-tight mb-6 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Schedule a call
            </h2>
            <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-lg min-h-[380px] w-full">
              <iframe
                title="Schedule a meeting with Jordan"
                src={CAL_EMBED_URL}
                className="w-full min-h-[380px] border-0"
              />
            </div>
          </section>

          {/* Get started CTA */}
          <section className="flex justify-center">
            <Button
              size="lg"
              className="w-full sm:w-auto h-14 rounded-2xl font-black px-8 shadow-lg shadow-primary/20"
              asChild
            >
              <Link href="/venue/onboard">
                <Coffee className="mr-2 h-5 w-5" />
                Get started! — It only takes ~15 minutes.
              </Link>
            </Button>
          </section>

          <footer className="pt-10 pb-8 text-center">
            <p className="text-sm text-muted-foreground">
              <a href="mailto:jordan@nooc.io" className="text-primary hover:underline">
                jordan@nooc.io
              </a>
              {demoPhone && (
                <>
                  {" · "}
                  <a href={`tel:${demoPhone}`} className="text-primary hover:underline">
                    Call
                  </a>
                </>
              )}
            </p>
          </footer>
        </div>
      </div>
    </div>
  )
}
