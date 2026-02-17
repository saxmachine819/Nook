import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { ReservationsClient } from "./ReservationsClient"
import { ReservationListItem } from "@/lib/types/reservations"

export default async function ReservationsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/profile?callbackUrl=/reservations")
  }

  const userId = session.user.id
  const now = new Date()

  const [upcomingCount, pastCount, cancelledCount, upcomingReservationsData] = await Promise.all([
    prisma.reservation.count({
      where: {
        userId,
        status: { not: "cancelled" },
        endAt: { gte: now },
      },
    }),
    prisma.reservation.count({
      where: {
        userId,
        status: { not: "cancelled" },
        endAt: { lt: now },
      },
    }),
    prisma.reservation.count({
      where: {
        userId,
        status: "cancelled",
      },
    }),
    prisma.reservation.findMany({
      where: {
        userId,
        status: { not: "cancelled" },
        endAt: { gte: now },
      },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
            address: true,
            heroImageUrl: true,
            imageUrls: true,
            hourlySeatPrice: true,
            googleMapsUrl: true,
          },
        },
        seat: {
          select: {
            id: true,
            label: true,
            position: true,
            pricePerHour: true,
            table: { select: { name: true } },
          },
        },
        table: {
          select: {
            id: true,
            name: true,
            seatCount: true,
            tablePricePerHour: true,
            seats: { select: { id: true } },
          },
        },
        payments: {
          include: {
            refundRequests: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1
        },
      },
      orderBy: { startAt: "asc" },
    }),
  ])

  // Map plural payments to singular payment for the client
  const upcomingReservations = upcomingReservationsData.map(res => ({
    ...res,
    payment: res.payments?.[0] || null
  }))

  return (
    <ReservationsClient
      initialUpcoming={upcomingReservations as unknown as ReservationListItem[]}
      counts={{
        upcoming: upcomingCount,
        past: pastCount,
        cancelled: cancelledCount,
      }}
    />
  )
}
