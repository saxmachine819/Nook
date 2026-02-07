import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { VenueEditClient } from "./VenueEditClient"

interface VenueEditPageProps {
  params: Promise<{ id: string }>
}

export default async function VenueDashboardEditPage({ params }: VenueEditPageProps) {
  const { id: venueId } = await params

  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    include: {
      tables: {
        include: {
          seats: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      venueHours: {
        orderBy: {
          dayOfWeek: "asc",
        },
      },
    },
  })

  if (!venue) {
    notFound()
  }

  return <VenueEditClient venue={venue} />
}
