/**
 * Supabase Storage helper functions for photo uploads
 * 
 * Setup:
 * 1. Create a storage bucket named "venue-photos" in Supabase Dashboard
 * 2. Set bucket to public (or configure RLS policies)
 * 3. Add environment variables:
 *    - NEXT_PUBLIC_SUPABASE_URL
 *    - NEXT_PUBLIC_SUPABASE_ANON_KEY
 *    - SUPABASE_SERVICE_ROLE_KEY (for server-side uploads)
 */

import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ Supabase environment variables not set. Photo uploads will be disabled.")
}

// Client for client-side operations (public bucket)
export const supabaseClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Client for server-side operations (service role key for private operations)
export const supabaseServiceClient = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

const BUCKET_NAME = "venue-photos"

/**
 * Upload a file to Supabase Storage
 * @param file - File object or Blob
 * @param path - Storage path (e.g., "tables/table-id/image.jpg")
 * @returns Public URL if successful, null if failed
 */
export async function uploadToSupabase(
  file: File | Blob,
  path: string
): Promise<string | null> {
  // Prefer service client for server-side uploads (bypasses RLS), fallback to anon client
  const client = supabaseServiceClient || supabaseClient
  
  if (!client) {
    console.error("❌ Supabase client not initialized")
    console.error("   URL:", supabaseUrl ? "✅ Set" : "❌ Missing")
    console.error("   Anon Key:", supabaseAnonKey ? "✅ Set" : "❌ Missing")
    console.error("   Service Key:", supabaseServiceKey ? "✅ Set" : "❌ Missing")
    return null
  }

  try {
    // Check file size safely (File API not available in Node.js, but Blob has size)
    const fileSize = 'size' in file ? file.size : 'unknown'
    const usingServiceClient = !!supabaseServiceClient
    console.log("📤 Uploading file to Supabase Storage:", { path, bucket: BUCKET_NAME, size: fileSize, usingServiceClient })
    
    const { data, error } = await client.storage
      .from(BUCKET_NAME)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      })

    if (error) {
      console.error("❌ Supabase upload error:", error)
      console.error("   Error message:", error.message)
      console.error("   Error status:", (error as any).statusCode)
      return null
    }

    if (!data) {
      console.error("❌ No data returned from Supabase upload")
      return null
    }

    // Get public URL (use any client for this, it's just generating a URL)
    const urlClient = supabaseClient || supabaseServiceClient
    if (!urlClient) {
      console.error("❌ No client available to generate public URL")
      return null
    }
    
    const { data: urlData } = urlClient.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path)

    console.log("✅ Upload successful, public URL:", urlData.publicUrl)
    return urlData.publicUrl
  } catch (error) {
    console.error("❌ Exception in uploadToSupabase:", error)
    if (error instanceof Error) {
      console.error("   Error message:", error.message)
      console.error("   Error stack:", error.stack)
    }
    return null
  }
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFromSupabase(path: string): Promise<boolean> {
  if (!supabaseClient) {
    console.error("Supabase client not initialized")
    return false
  }

  try {
    const { error } = await supabaseClient.storage
      .from(BUCKET_NAME)
      .remove([path])

    if (error) {
      console.error("Error deleting from Supabase:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("Error in deleteFromSupabase:", error)
    return false
  }
}
