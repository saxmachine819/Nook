import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { venue: false, tables: [], seats: [] },
        { status: 200 }
      );
    }

    const params = await context.params;
    const venueId = params.id;
    const userId = session.user.id;

    const [venueFav, tableFavs, seatFavs] = await Promise.all([
      prisma.favoriteVenue.findUnique({
        where: {
          userId_venueId: {
            userId,
            venueId,
          },
        },
      }),
      prisma.favoriteTable.findMany({
        where: {
          userId,
          venueId,
        },
        select: { tableId: true },
      }),
      prisma.favoriteSeat.findMany({
        where: {
          userId,
          venueId,
        },
        select: { seatId: true },
      }),
    ]);

    return NextResponse.json({
      venue: !!venueFav,
      tables: tableFavs.map((t) => t.tableId),
      seats: seatFavs.map((s) => s.seatId),
    });
  } catch (error) {
    console.error("Error fetching favorites:", error);
    return NextResponse.json(
      { error: "Failed to fetch favorites" },
      { status: 500 }
    );
  }
}
