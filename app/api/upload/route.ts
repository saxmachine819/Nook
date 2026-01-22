import { NextRequest, NextResponse } from "next/server"
import { uploadToSupabase } from "@/lib/supabase-storage"

/**
 * API route for uploading photos to Supabase Storage
 * 
 * POST /api/upload
 * Body: FormData with 'file' field
 * Query params: ?type=table|seat&id=<id>
 * 
 * Returns: { url: string } or { error: string }
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    // Get type and id from FormData (sent from client) or fallback to query params
    const type = (formData.get("type") as string) || request.nextUrl.searchParams.get("type") || "venue"
    const id = (formData.get("id") as string) || request.nextUrl.searchParams.get("id") || "temp"

    console.log("📤 Upload request:", { type, id, fileName: file?.name, fileSize: file?.size })

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size must be less than 5MB" },
        { status: 400 }
      )
    }

    // Generate unique filename
    const timestamp = Date.now()
    const extension = file.name.split(".").pop() || "jpg"
    const filename = `${timestamp}-${Math.random().toString(36).substring(7)}.${extension}`
    // Path format: type/id/filename (e.g., "table/table-123/image.jpg" or "seat/seat-456/image.jpg")
    const path = `${type}/${id}/${filename}`

    // Check if Supabase is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error("❌ Supabase environment variables not set")
      return NextResponse.json(
        { 
          error: "Supabase Storage not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env file.",
        },
        { status: 500 }
      )
    }

    console.log("📤 Uploading to Supabase:", { path, bucket: "venue-photos" })
    
    // Upload to Supabase
    const url = await uploadToSupabase(file, path)

    if (!url) {
      console.error("❌ Upload failed - uploadToSupabase returned null")
      return NextResponse.json(
        { 
          error: "Failed to upload file. Please check your Supabase Storage configuration.",
          details: process.env.NODE_ENV === "development" 
            ? "Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set, and the 'venue-photos' bucket exists and is public."
            : undefined
        },
        { status: 500 }
      )
    }

    console.log("✅ Upload successful:", url)

    return NextResponse.json({ url })
  } catch (error: any) {
    console.error("Error in upload route:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error?.message },
      { status: 500 }
    )
  }
}
