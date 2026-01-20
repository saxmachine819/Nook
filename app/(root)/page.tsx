import { prisma } from "@/lib/prisma"
import { ExploreClient } from "./ExploreClient"

export default async function ExplorePage() {
  try {
    // Fetch all venues from database
    const venues = await prisma.venue.findMany({
      include: {
        tables: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    // Format venues for client component
    const formattedVenues = venues.map((venue) => ({
      id: venue.id,
      name: venue.name,
      address: venue.address || "",
      neighborhood: venue.neighborhood || "",
      city: venue.city || "",
      state: venue.state || "",
      latitude: venue.latitude,
      longitude: venue.longitude,
      hourlySeatPrice: venue.hourlySeatPrice,
      tags: venue.tags || [],
    }))

    return <ExploreClient venues={formattedVenues} />
  } catch (error) {
    console.error("Error fetching venues:", error)
    // Return empty array on error to prevent page crash
    return <ExploreClient venues={[]} />
  }
}