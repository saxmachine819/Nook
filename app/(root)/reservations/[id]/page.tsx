import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import { isAdmin } from "@/lib/venue-auth"
import { ReservationDetailClient } from "./ReservationDetailClient"

async function getReservation(reservationId: string, userId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
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
          rulesText: true,
          tags: true,
        },
      },
      seat: {
        include: {
          table: {
            select: {
              name: true,
              directionsText: true,
            },
          },
        },
      },
      table: {
        select: {
          name: true,
          seatCount: true,
          tablePricePerHour: true,
          directionsText: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  })

  if (!reservation) {
    return null
  }

  // Authorization: owner or admin
  const session = await auth()
  const isOwner = reservation.userId === userId
  const userIsAdmin = session?.user ? isAdmin(session.user) : false

  if (!isOwner && !userIsAdmin) {
    return null
  }

  return reservation
}

export default async function ReservationDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/profile?callbackUrl=/reservations/" + params.id)
  }

  const reservation = await getReservation(params.id, session.user.id)

  if (!reservation) {
    notFound()
  }

  return <ReservationDetailClient reservation={reservation} />
}
