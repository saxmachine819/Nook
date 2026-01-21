import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Calendar, Clock, MapPin } from "lucide-react"
import { CancelReservationButton } from "@/components/reservation/CancelReservationButton"
import { redirect } from "next/navigation"

async function getReservations(userId: string) {
  const now = new Date()

  const reservations = await prisma.reservation.findMany({
    where: {
      userId,
      endAt: {
        gte: now,
      },
    },
    orderBy: {
      startAt: "asc",
    },
    include: {
      venue: true,
    },
  })

  return reservations
}

function formatDateTimeRange(startAt: Date, endAt: Date) {
  const start = new Date(startAt)
  const end = new Date(endAt)

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })

  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })

  return `${dateFormatter.format(start)} · ${timeFormatter.format(start)} – ${timeFormatter.format(
    end
  )}`
}

export default async function ReservationsPage() {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect("/profile?callbackUrl=/reservations")
  }

  const reservations = await getReservations(session.user.id)

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">
        Reservations
      </h1>

      {reservations.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="mb-2 text-xl font-semibold">No upcoming reservations</h2>
          <p className="text-sm text-muted-foreground">
            When you reserve seats, they&apos;ll appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reservations.map((reservation) => (
            <ReservationCard
              key={reservation.id}
              reservation={{
                id: reservation.id,
                seatCount: reservation.seatCount,
                status: reservation.status,
                startAt: reservation.startAt.toISOString(),
                endAt: reservation.endAt.toISOString(),
                venueName: reservation.venue.name,
                venueAddress: reservation.venue.address ?? "",
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface ReservationCardProps {
  reservation: {
    id: string
    seatCount: number
    status: string
    startAt: string
    endAt: string
    venueName: string
    venueAddress: string
  }
}

function ReservationCard({ reservation }: ReservationCardProps) {
  const isCancelled = reservation.status === "cancelled"
  const dateRange = formatDateTimeRange(
    new Date(reservation.startAt),
    new Date(reservation.endAt)
  )

  return (
    <div className="flex items-start justify-between rounded-lg border bg-card px-4 py-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">
            {reservation.venueName}
          </h2>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              isCancelled
                ? "bg-red-50 text-red-700"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {isCancelled ? "Cancelled" : "Active"}
          </span>
        </div>

        {reservation.venueAddress && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{reservation.venueAddress}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{dateRange}</span>
        </div>

        <p className="text-xs text-muted-foreground">
          {reservation.seatCount} seat{reservation.seatCount > 1 ? "s" : ""}
        </p>
      </div>

      <div className="ml-3">
        <CancelReservationButton
          reservationId={reservation.id}
          disabled={isCancelled}
        />
      </div>
    </div>
  )
}

