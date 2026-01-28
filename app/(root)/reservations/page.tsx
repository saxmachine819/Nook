import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { ReservationsClient } from "./ReservationsClient"

async function getReservations(userId: string) {
  const now = new Date()

  // Fetch all reservations for the user with full venue and seat/table details
  const allReservations = await prisma.reservation.findMany({
    where: {
      userId,
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
    },
    orderBy: {
      startAt: "desc", // Default: most recent first (we'll sort per category)
    },
  })

  // Categorize reservations
  const upcoming: typeof allReservations = []
  const past: typeof allReservations = []
  const cancelled: typeof allReservations = []

  for (const reservation of allReservations) {
    if (reservation.status === "cancelled") {
      cancelled.push(reservation)
    } else if (reservation.endAt >= now) {
      upcoming.push(reservation)
    } else {
      past.push(reservation)
    }
  }

  // Sort upcoming by startAt ascending (nearest first)
  upcoming.sort((a, b) => a.startAt.getTime() - b.startAt.getTime())

  // Sort past and cancelled by startAt descending (most recent first)
  past.sort((a, b) => b.startAt.getTime() - a.startAt.getTime())
  cancelled.sort((a, b) => b.startAt.getTime() - a.startAt.getTime())

  return {
    upcoming,
    past,
    cancelled,
  }
}

export default async function ReservationsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/profile?callbackUrl=/reservations")
  }

  const { upcoming, past, cancelled } = await getReservations(session.user.id)

  return <ReservationsClient upcoming={upcoming} past={past} cancelled={cancelled} />
}
