import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/venue-auth"
import { runDispatcher } from "@/lib/email-dispatch"

export const dynamic = "force-dynamic"

export async function POST() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "You must be signed in to run the dispatcher." },
      { status: 401 }
    )
  }

  if (!isAdmin(session.user)) {
    return NextResponse.json(
      { error: "Unauthorized: Admin access required" },
      { status: 403 }
    )
  }

  const result = await runDispatcher()

  if (result.envError) {
    return NextResponse.json(
      {
        error: result.envError,
        processed: result.processed,
        sent: result.sent,
        failed: result.failed,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    processed: result.processed,
    sent: result.sent,
    failed: result.failed,
  })
}
