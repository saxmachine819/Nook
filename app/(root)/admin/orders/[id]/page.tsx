import React from "react"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/venue-auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { OrderDetailClient } from "./OrderDetailClient"

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
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

  const { id } = await params

  const order = await prisma.signageOrder.findUnique({
    where: { id },
    include: {
      venue: { select: { name: true, address: true } },
      template: { select: { id: true, name: true } },
      items: {
        include: { qrAsset: { select: { token: true } } },
      },
    },
  })

  if (!order) {
    notFound()
  }

  const orderForClient = {
    id: order.id,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    contactName: order.contactName,
    contactEmail: order.contactEmail,
    contactPhone: order.contactPhone,
    shipAddress1: order.shipAddress1,
    shipAddress2: order.shipAddress2,
    shipCity: order.shipCity,
    shipState: order.shipState,
    shipPostalCode: order.shipPostalCode,
    shipCountry: order.shipCountry,
    shippingNotes: order.shippingNotes,
    trackingCarrier: order.trackingCarrier,
    trackingNumber: order.trackingNumber,
    shippedAt: order.shippedAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    venue: order.venue,
    template: order.template,
    items: order.items.map((i) => ({
      id: i.id,
      label: i.label,
      qrScopeType: i.qrScopeType,
      designOption: i.designOption,
      qrAsset: i.qrAsset,
    })),
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <Button asChild variant="outline">
          <Link href="/admin/orders">Back to Orders</Link>
        </Button>
      </div>

      <OrderDetailClient order={orderForClient} />
    </div>
  )
}
