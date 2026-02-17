import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import { isAdmin } from "@/lib/venue-auth"
import { ReservationDetailClient } from "./ReservationDetailClient"
import { ReservationDetail } from "@/lib/types/reservations"

export default async function ReservationDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const [session, reservationData] = await Promise.all([
    auth(),
    prisma.reservation.findUnique({
      where: { id: params.id },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
            address: true,
            heroImageUrl: true,
            hourlySeatPrice: true,
            // Fetch these async later: imageUrls, googleMapsUrl, rulesText, tags
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
            name: true,
            seatCount: true,
            tablePricePerHour: true,
            // Fetch async: directionsText, seats
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
    }),
  ])

  if (!session?.user?.id) {
    redirect("/profile?callbackUrl=/reservations/" + params.id)
  }

  if (!reservationData) {
    notFound()
  }

  // Map plural payments to singular payment for the client
  const reservation = {
    ...reservationData,
    payment: reservationData.payments?.[0] || null
  }

  // Authorization: owner or admin
  const isOwner = reservation.userId === session.user.id
  const userIsAdmin = isAdmin(session.user)

  if (!isOwner && !userIsAdmin) {
    notFound() // Or redirect to unauthorized
  }

  return <ReservationDetailClient reservation={reservation as unknown as ReservationDetail} />
}
