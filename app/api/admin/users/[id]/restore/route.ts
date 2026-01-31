import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/venue-auth"
import { writeAuditLog } from "@/lib/audit"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to restore a user." },
        { status: 401 }
      )
    }

    if (!isAdmin(session.user)) {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required." },
        { status: 403 }
      )
    }

    const params = await context.params
    const userId = params.id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 })
    }

    if (user.status !== "DELETED") {
      return NextResponse.json(
        { error: "User is not deleted. Nothing to restore." },
        { status: 409 }
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          status: "ACTIVE",
          deletedAt: null,
          deletionReason: null,
        },
      })

      await writeAuditLog(
        {
          actorUserId: session.user.id,
          action: "USER_RESTORED",
          entityType: "USER",
          entityId: userId,
          metadata: {},
        },
        tx as any
      )
    })

    return NextResponse.json({
      success: true,
      user: { id: userId, status: "ACTIVE" },
      message: "User restored. Note: Anonymized PII (name/email) is not restored.",
    })
  } catch (error) {
    console.error("Error restoring user:", error)
    return NextResponse.json(
      { error: "Failed to restore user. Please try again." },
      { status: 500 }
    )
  }
}
