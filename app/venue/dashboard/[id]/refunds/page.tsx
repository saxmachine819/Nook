import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditVenue } from "@/lib/venue-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RefundRequestsClient } from "./RefundRequestsClient"

export default async function RefundsPage({ params }: { params: { id: string } }) {
  const session = await auth()

  if (!session?.user?.id) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You must be signed in to view refund requests.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const venue = await prisma.venue.findUnique({
    where: { id: params.id },
    select: { id: true, ownerId: true },
  })

  if (!venue || !canEditVenue(session.user, venue)) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Permission denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You don&apos;t have access to this venue&apos;s refund requests.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const rows = await prisma.refundRequest.findMany({
    where: { venueId: params.id },
    include: {
      reservation: true,
      user: { select: { name: true, email: true } },
      payment: true,
    },
    orderBy: { createdAt: "desc" },
  })

  const refundRequests = rows
    .filter((r): r is typeof r & { reservation: NonNullable<typeof r.reservation> } => r.reservation != null)
    .map((r) => ({
      id: r.id,
      status: r.status,
      requestedAmount: r.amount,
      approvedAmount: r.status === "SUCCEEDED" ? r.amount : null,
      reason: r.reason,
      createdAt: r.createdAt,
      payment: {
        id: r.payment.id,
        amount: r.payment.amount,
        currency: r.payment.currency,
        amountRefunded: r.payment.amountRefunded,
      },
      reservation: {
        id: r.reservation.id,
        startAt: r.reservation.startAt,
        endAt: r.reservation.endAt,
      },
      user: {
        name: r.user?.name ?? null,
        email: r.user?.email ?? null,
      },
    }))

  return (
    <RefundRequestsClient
      venueId={params.id}
      refundRequests={refundRequests}
    />
  )
}
