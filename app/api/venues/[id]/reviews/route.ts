import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const venueId = params.id
    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get("cursor")
    const limitParam = parseInt(searchParams.get("limit") || "10", 10)
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 10

    const [reviews, aggregate] = await Promise.all([
      prisma.review.findMany({
        where: { venueId },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          userId: true,
          rating: true,
          comment: true,
          createdAt: true,
          user: { select: { name: true } },
        },
      }),
      prisma.review.aggregate({
        where: { venueId },
        _avg: { rating: true },
        _count: true,
      }),
    ])

    const hasMore = reviews.length > limit
    const page = hasMore ? reviews.slice(0, limit) : reviews

    return NextResponse.json({
      reviews: page,
      aggregate: {
        avg: aggregate._avg.rating ?? 0,
        count: aggregate._count,
      },
      nextCursor: hasMore ? page[page.length - 1].id : null,
    })
  } catch (error) {
    console.error("Error fetching venue reviews:", error)
    return NextResponse.json({ error: "Failed to fetch reviews." }, { status: 500 })
  }
}
