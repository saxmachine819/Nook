import React from "react"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/venue-auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import type { SignageOrderStatus } from "@prisma/client"
import { OrdersClient } from "./OrdersClient"

const VALID_STATUSES: SignageOrderStatus[] = ["NEW", "IN_PRODUCTION", "SHIPPED", "DELIVERED", "CANCELLED"]

async function getOrders(statusFilter?: string, searchQuery?: string) {
  try {
    const where: { status?: SignageOrderStatus; venueId?: { in: string[] } } = {}
    if (statusFilter && VALID_STATUSES.includes(statusFilter as SignageOrderStatus)) {
      where.status = statusFilter as SignageOrderStatus
    }
    if (searchQuery && searchQuery.trim().length > 0) {
      const q = searchQuery.trim()
      const venues = await prisma.venue.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { address: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      })
      const venueIds = venues.map((v) => v.id)
      if (venueIds.length === 0) {
        return []
      }
      where.venueId = { in: venueIds }
    }

    const orders = await prisma.signageOrder.findMany({
      where,
      include: {
        venue: { select: { name: true, address: true } },
        template: { select: { name: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return orders.map((o) => ({
      id: o.id,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
      venue: o.venue,
      template: o.template,
      items: o.items,
    }))
  } catch (error) {
    console.error("Error fetching orders:", error)
    return []
  }
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>
}) {
  const session = await auth()

  if (!session?.user || !isAdmin(session.user)) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Not authorized</CardTitle>
              <CardDescription>
                You do not have permission to access this page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/">Go to Home</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const params = await searchParams
  const status = params?.status || ""
  const search = params?.search || ""
  const orders = await getOrders(status || undefined, search || undefined)

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
            <p className="text-sm text-muted-foreground">
              Signage orders — manual fulfillment
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin">Back to Admin</Link>
          </Button>
        </div>
      </div>

      <OrdersClient
        initialOrders={orders}
        initialStatus={status}
        initialSearch={search}
      />
    </div>
  )
}
