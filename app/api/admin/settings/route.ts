import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/venue-auth"
import { getSiteSetting, setSiteSetting } from "@/lib/site-settings"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const key = searchParams.get("key")

  if (!key) {
    return NextResponse.json({ error: "Missing key parameter" }, { status: 400 })
  }

  const value = await getSiteSetting(key)
  return NextResponse.json({ key, value })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { key, value } = body

  if (!key || value === undefined) {
    return NextResponse.json({ error: "Missing key or value" }, { status: 400 })
  }

  await setSiteSetting(key, String(value))
  return NextResponse.json({ key, value: String(value) })
}
