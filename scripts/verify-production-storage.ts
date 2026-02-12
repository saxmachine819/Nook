/**
 * Verification script for production Supabase Storage setup
 * 
 * This script verifies that the production Supabase Storage is configured correctly
 * for photo uploads.
 * 
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL="production-supabase-url" \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY="production-anon-key" \
 *   SUPABASE_SERVICE_ROLE_KEY="production-service-role-key" \
 *   npx tsx scripts/verify-production-storage.ts
 */

import { createClient } from "@supabase/supabase-js"

const BUCKET_NAME = "venue-photos"

async function main() {
  console.log("🔍 Verifying production Supabase Storage setup...\n")

  // Get environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Check environment variables
  console.log("📋 Environment Variables:")
  console.log(`   NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? "✅ Set" : "❌ Missing"}`)
  console.log(`   NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? "✅ Set" : "❌ Missing"}`)
  console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey ? "✅ Set" : "❌ Missing"}`)

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("\n❌ Missing required environment variables")
    console.log("   Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY")
    process.exit(1)
  }

  // Create clients
  const anonClient = createClient(supabaseUrl, supabaseAnonKey)
  const serviceClient = supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null

  let allChecksPassed = true

  // Check 1: Bucket exists
  console.log(`\n📦 Check 1: Bucket '${BUCKET_NAME}' exists`)
  try {
    const client = serviceClient || anonClient
    const { data: buckets, error } = await client.storage.listBuckets()

    if (error) {
      console.log(`   ❌ Error: ${error.message}`)
      allChecksPassed = false
    } else {
      const bucketExists = buckets?.some(b => b.name === BUCKET_NAME)
      if (bucketExists) {
        console.log("   ✅ Bucket exists")
        
        // Check if public
        const bucket = buckets?.find(b => b.name === BUCKET_NAME)
        if (bucket?.public) {
          console.log("   ✅ Bucket is public")
        } else {
          console.log("   ⚠️  Bucket is NOT public")
          console.log("      Go to Storage → venue-photos → Settings → Enable 'Public bucket'")
          allChecksPassed = false
        }
      } else {
        console.log("   ❌ Bucket does NOT exist")
        console.log("      Create it: Storage → New bucket → Name: venue-photos → Public")
        allChecksPassed = false
      }
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`)
    allChecksPassed = false
  }

  // Check 2: Can list files (tests SELECT policy)
  console.log(`\n📋 Check 2: Can read from bucket (SELECT policy)`)
  try {
    const { data, error } = await anonClient.storage
      .from(BUCKET_NAME)
      .list("", { limit: 1 })

    if (error) {
      console.log(`   ❌ Error: ${error.message}`)
      console.log("      Missing SELECT policy. Run setup-production-storage-policies.sql")
      allChecksPassed = false
    } else {
      console.log("   ✅ Can read from bucket")
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`)
    allChecksPassed = false
  }

  // Check 3: Can upload (tests INSERT policy)
  console.log(`\n📤 Check 3: Can upload to bucket (INSERT policy)`)
  try {
    // Create a small test file
    const testContent = new Blob(["test"], { type: "text/plain" })
    const testPath = `test/verify-${Date.now()}.txt`

    const { data, error } = await anonClient.storage
      .from(BUCKET_NAME)
      .upload(testPath, testContent, {
        cacheControl: "3600",
        upsert: false,
      })

    if (error) {
      console.log(`   ❌ Error: ${error.message}`)
      console.log("      Missing INSERT policy. Run setup-production-storage-policies.sql")
      allChecksPassed = false
    } else {
      console.log("   ✅ Can upload to bucket")
      
      // Clean up test file
      try {
        await anonClient.storage.from(BUCKET_NAME).remove([testPath])
        console.log("   ✅ Test file cleaned up")
      } catch (cleanupError) {
        console.log("   ⚠️  Could not clean up test file (not critical)")
      }
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`)
    allChecksPassed = false
  }

  // Check 4: Can get public URL
  console.log(`\n🔗 Check 4: Can generate public URLs`)
  try {
    const { data } = anonClient.storage
      .from(BUCKET_NAME)
      .getPublicUrl("test/image.jpg")

    if (data?.publicUrl) {
      console.log("   ✅ Can generate public URLs")
      console.log(`   Example URL: ${data.publicUrl.substring(0, 60)}...`)
    } else {
      console.log("   ⚠️  Could not generate public URL")
      allChecksPassed = false
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`)
    allChecksPassed = false
  }

  // Summary
  console.log("\n" + "=".repeat(60))
  if (allChecksPassed) {
    console.log("✅ All checks passed! Production storage is configured correctly.")
    console.log("=".repeat(60))
  } else {
    console.log("❌ Some checks failed. Please fix the issues above.")
    console.log("=".repeat(60))
    console.log("\n📋 Next Steps:")
    console.log("   1. Create bucket if missing: Storage → New bucket → venue-photos")
    console.log("   2. Make bucket public: Storage → venue-photos → Settings → Public")
    console.log("   3. Run policies SQL: scripts/setup-production-storage-policies.sql")
    console.log("   4. Verify environment variables in Vercel production")
    process.exit(1)
  }
}

main()
  .catch((error) => {
    console.error("❌ Fatal error:", error)
    process.exit(1)
  })
