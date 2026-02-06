import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { termsAcceptedAt: new Date() },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("POST /api/users/me/accept-terms:", e)
    return NextResponse.json(
      { error: "Failed to accept terms." },
      { status: 500 }
    )
  }
}
