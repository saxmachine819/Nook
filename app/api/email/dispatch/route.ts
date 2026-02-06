import { NextResponse } from "next/server"
import { runDispatcher } from "@/lib/email-dispatch"

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("Authorization")?.trim() ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : ""
  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await runDispatcher()

  if (result.envError) {
    return NextResponse.json(
      { error: result.envError, processed: result.processed, sent: result.sent, failed: result.failed },
      { status: 500 }
    )
  }

  return NextResponse.json({
    processed: result.processed,
    sent: result.sent,
    failed: result.failed,
  })
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    const secret = process.env.DISPATCH_SECRET
    const provided = request.headers.get("x-dispatch-secret")?.trim() ?? ""
    if (!secret || provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const result = await runDispatcher()

  if (result.envError) {
    return NextResponse.json(
      { error: result.envError, processed: result.processed, sent: result.sent, failed: result.failed },
      { status: 500 }
    )
  }

  return NextResponse.json({
    processed: result.processed,
    sent: result.sent,
    failed: result.failed,
  })
}
