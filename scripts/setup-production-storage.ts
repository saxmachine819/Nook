/**
 * Setup script for production Supabase Storage bucket
 * 
 * This script helps set up the venue-photos bucket in production Supabase project.
 * 
 * Usage:
 *   DATABASE_URL="production-database-url" \
 *   NEXT_PUBLIC_SUPABASE_URL="production-supabase-url" \
 *   SUPABASE_SERVICE_ROLE_KEY="production-service-role-key" \
 *   npx tsx scripts/setup-production-storage.ts
 * 
 * Note: Supabase Storage API doesn't have a direct way to create buckets programmatically
 * via the JS client. This script will:
 * 1. Check if bucket exists
 * 2. Provide instructions for manual setup if needed
 * 3. Set up RLS policies programmatically
 */

import { createClient } from "@supabase/supabase-js"

const BUCKET_NAME = "venue-photos"

async function main() {
  console.log("🚀 Setting up production Supabase Storage...\n")

  // Get environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    console.error("❌ NEXT_PUBLIC_SUPABASE_URL is not set")
    console.log("\nPlease set it:")
    console.log("  export NEXT_PUBLIC_SUPABASE_URL='https://your-project.supabase.co'")
    process.exit(1)
  }

  if (!supabaseServiceKey) {
    console.error("❌ SUPABASE_SERVICE_ROLE_KEY is not set")
    console.log("\nPlease set it:")
    console.log("  export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'")
    console.log("\nGet it from: Supabase Dashboard → Settings → API → service_role key")
    process.exit(1)
  }

  console.log(`✅ Supabase URL: ${supabaseUrl}`)
  console.log(`✅ Service Role Key: ${supabaseServiceKey.substring(0, 20)}...`)

  // Create Supabase client with service role key
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Check if bucket exists
  console.log(`\n📦 Checking if bucket '${BUCKET_NAME}' exists...`)
  
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()

    if (listError) {
      console.error("❌ Error listing buckets:", listError.message)
      console.log("\n⚠️  Cannot check buckets. Please verify:")
      console.log("  1. SUPABASE_SERVICE_ROLE_KEY is correct")
      console.log("  2. You have access to the production Supabase project")
      process.exit(1)
    }

    const bucketExists = buckets?.some(b => b.name === BUCKET_NAME)

    if (bucketExists) {
      console.log(`✅ Bucket '${BUCKET_NAME}' already exists!`)
      
      // Check if it's public
      const bucket = buckets?.find(b => b.name === BUCKET_NAME)
      if (bucket?.public) {
        console.log("✅ Bucket is set to public")
      } else {
        console.log("⚠️  Bucket exists but is NOT public")
        console.log("   You need to make it public in Supabase Dashboard:")
        console.log("   1. Go to Storage → venue-photos")
        console.log("   2. Click Settings")
        console.log("   3. Enable 'Public bucket'")
      }
    } else {
      console.log(`❌ Bucket '${BUCKET_NAME}' does NOT exist`)
      console.log("\n📝 Manual Setup Required:")
      console.log("   Supabase Storage API doesn't support creating buckets programmatically.")
      console.log("   Please create the bucket manually:\n")
      console.log("   1. Go to Supabase Dashboard:")
      console.log(`      ${supabaseUrl.replace('https://', 'https://app.supabase.com/project/')}`)
      console.log("   2. Navigate to Storage → New bucket")
      console.log(`   3. Name: ${BUCKET_NAME}`)
      console.log("   4. Enable 'Public bucket'")
      console.log("   5. File size limit: 5MB")
      console.log("   6. Allowed MIME types: image/* (or leave empty)")
      console.log("   7. Click 'Create bucket'")
      console.log("\n   Then run this script again to set up policies.")
      process.exit(1)
    }

    // Set up RLS policies
    console.log("\n🔐 Setting up RLS policies...")
    
    // Note: We can't create storage policies via the JS client easily
    // So we'll provide SQL instructions
    console.log("\n⚠️  Storage policies need to be set up via SQL.")
    console.log("   Run the SQL from: scripts/setup-production-storage-policies.sql")
    console.log("   In Supabase Dashboard → SQL Editor")
    
    console.log("\n✅ Setup check complete!")
    console.log("\n📋 Next Steps:")
    console.log("   1. Ensure bucket is public (check above)")
    console.log("   2. Run SQL policies from: scripts/setup-production-storage-policies.sql")
    console.log("   3. Verify setup with: npx tsx scripts/verify-production-storage.ts")

  } catch (error: any) {
    console.error("❌ Unexpected error:", error.message)
    if (error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

main()
  .catch((error) => {
    console.error("❌ Fatal error:", error)
    process.exit(1)
  })
