import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to view signage templates." },
        { status: 401 }
      )
    }

    const templates = await prisma.signageTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        previewImageUrl: true,
      },
    })

    return NextResponse.json({ templates })
  } catch (error) {
    console.error("Error fetching signage templates:", error)
    return NextResponse.json(
      { error: "Failed to load templates." },
      { status: 500 }
    )
  }
}
