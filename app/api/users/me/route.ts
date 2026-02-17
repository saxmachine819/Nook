import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/venue-auth"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminStatus = isAdmin(session.user)

    return NextResponse.json({
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      isAdmin: adminStatus,
    })
  } catch (error) {
    console.error("GET /api/users/me:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
