import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireVenueAdminOrOwner } from "@/lib/venue-members"
import { stripe } from "@/lib/stripe"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import timezone from "dayjs/plugin/timezone"

dayjs.extend(utc)
dayjs.extend(timezone)

export const runtime = "nodejs"

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const venueId = params.id
    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period") || "daily"

    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 })
    }

    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, stripeAccountId: true, timezone: true, ownerId: true },
    })

    if (!venue) {
      return NextResponse.json({ error: "Venue not found." }, { status: 404 })
    }

    const guard = await requireVenueAdminOrOwner(venueId, session.user, { ownerId: venue.ownerId })
    if (guard) return guard

    if (!venue.stripeAccountId) {
      return NextResponse.json({ revenue: 0, currency: "usd" })
    }

    const tz = venue.timezone || "UTC"
    const now = dayjs().tz(tz)
    
    let startTimestamp: number
    if (period === "weekly") {
      // Start of the current week (Sunday or Monday depends on locale, default is Sunday)
      startTimestamp = now.startOf("week").unix()
    } else {
      // Start of today
      startTimestamp = now.startOf("day").unix()
    }

    let totalRevenue = 0
    let hasMore = true
    let startingAfter: string | undefined = undefined

    // Iterate to sum revenue. We limit to 3 pages (300 transactions) to keep it fast.
    let pages = 0
    while (hasMore && pages < 3) {
      const response: any = await stripe.balanceTransactions.list(
        {
          created: { gte: startTimestamp },
          limit: 100,
          starting_after: startingAfter,
        },
        {
          stripeAccount: venue.stripeAccountId,
        }
      )

      for (const tx of response.data) {
        // type 'charge' or 'payment' are usually the gross income
        if (tx.type === "charge" || tx.type === "payment") {
          totalRevenue += tx.amount
        }
      }

      hasMore = response.has_more
      if (hasMore) {
        startingAfter = response.data[response.data.length - 1].id
      }
      pages++
    }

    return NextResponse.json({
      revenue: totalRevenue,
      currency: "usd",
      period
    })
  } catch (error) {
    console.error("GET /api/venues/[id]/stripe/revenue:", error)
    return NextResponse.json(
      { error: "Unable to load revenue." },
      { status: 500 }
    )
  }
}
