import { NextResponse } from "next/server"

export async function GET() {
  const hasGoogleId = !!process.env.GOOGLE_CLIENT_ID
  const hasGoogleSecret = !!process.env.GOOGLE_CLIENT_SECRET
  const hasNextAuthUrl = !!process.env.NEXTAUTH_URL
  const hasNextAuthSecret = !!process.env.NEXTAUTH_SECRET

  return NextResponse.json({
    google: {
      clientId: hasGoogleId ? "✅ Set" : "❌ Missing",
      clientSecret: hasGoogleSecret ? "✅ Set" : "❌ Missing",
      clientIdValue: process.env.GOOGLE_CLIENT_ID?.substring(0, 20) + "...",
    },
    nextauth: {
      url: process.env.NEXTAUTH_URL || "❌ Missing",
      secret: hasNextAuthSecret ? "✅ Set" : "❌ Missing",
    },
    allConfigured: hasGoogleId && hasGoogleSecret && hasNextAuthUrl && hasNextAuthSecret,
  })
}
