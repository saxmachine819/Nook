import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

/**
 * Register or refresh a device push token for the signed-in user.
 * Called from the Capacitor shell after PushNotifications.register().
 */
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const token = typeof body.token === "string" ? body.token.trim() : ""
    const platform = body.platform === "ios" || body.platform === "android"
      ? body.platform
      : null

    if (!token || !platform) {
      return NextResponse.json(
        { error: "token and platform (ios|android) are required" },
        { status: 400 }
      )
    }

    const row = await prisma.devicePushToken.upsert({
      where: { token },
      create: {
        userId: session.user.id,
        token,
        platform,
        lastSeenAt: new Date(),
      },
      update: {
        userId: session.user.id,
        platform,
        lastSeenAt: new Date(),
      },
      select: { id: true, platform: true },
    })

    return NextResponse.json({ ok: true, id: row.id, platform: row.platform })
  } catch (error) {
    console.error("POST /api/devices/push-token:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Unregister a device token (e.g. on sign-out).
 */
export async function DELETE(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const token = typeof body.token === "string" ? body.token.trim() : ""
    if (!token) {
      return NextResponse.json({ error: "token is required" }, { status: 400 })
    }

    await prisma.devicePushToken.deleteMany({
      where: { userId: session.user.id, token },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("DELETE /api/devices/push-token:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
