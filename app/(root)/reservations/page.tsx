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

  const [upcomingCount, pastCount, cancelledCount, upcomingReservations] = await Promise.all([
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
            // Still exclude heavy rulesText/googleMapsUrl for list
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
      },
      orderBy: { startAt: "asc" },
    }),
  ])

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
