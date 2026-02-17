# Production Storage Setup Guide

This guide explains how to set up Supabase Storage for photo uploads in the **production** Supabase project.

**Note**: If photo uploads work in staging/local but fail in production, this guide will help you set up production.

## Prerequisites

1. Access to production Supabase Dashboard
2. Access to Vercel production environment variables
3. Production Supabase project URL and API keys

## Step 1: Identify Production Supabase Project

1. Go to [Vercel Dashboard](https://vercel.com)
2. Select your production project
3. Go to **Settings** → **Environment Variables**
4. Find `NEXT_PUBLIC_SUPABASE_URL`
5. Copy the value (e.g., `https://xxxxx.supabase.co`)

**Important**: Make sure you're looking at **Production** environment variables, not Preview or Development.

## Step 2: Create Storage Bucket in Production

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. **Select your PRODUCTION project** (match the URL from Step 1)
3. Navigate to **Storage** in the left sidebar
4. Click **New bucket** button
5. Configure the bucket:
   - **Name**: `venue-photos` (must be exactly this name)
   - **Public bucket**: ✅ **Enable this** (makes images publicly accessible)
   - **File size limit**: 5MB (recommended)
   - **Allowed MIME types**: Leave empty OR enter `image/*`
6. Click **Create bucket**

**Critical**: The bucket name must be exactly `venue-photos` - the code references this specific name.

## Step 3: Set Up Bucket Policies

You need to allow public uploads and reads. Choose one method:

### Option A: Via Supabase Dashboard (Easiest)

1. Go to **Storage** → `venue-photos` bucket
2. Click the **Policies** tab
3. Click **New Policy**
4. Choose **For full customization**

**Policy 1: Allow Public Uploads**
- **Policy name**: `Allow public uploads to venue-photos`
- **Allowed operation**: `INSERT`
- **Policy definition**: 
  ```sql
  bucket_id = 'venue-photos'
  ```
- Click **Review** then **Save policy**

**Policy 2: Allow Public Reads**
- **Policy name**: `Allow public reads from venue-photos`
- **Allowed operation**: `SELECT`
- **Policy definition**: 
  ```sql
  bucket_id = 'venue-photos'
  ```
- Click **Review** then **Save policy**

**Policy 3: Allow Public Updates** (Optional but recommended)
- **Policy name**: `Allow public updates to venue-photos`
- **Allowed operation**: `UPDATE`
- **Policy definition**: 
  ```sql
  bucket_id = 'venue-photos'
  ```
- Click **Review** then **Save policy**

**Policy 4: Allow Public Deletes** (Optional but recommended)
- **Policy name**: `Allow public deletes from venue-photos`
- **Allowed operation**: `DELETE`
- **Policy definition**: 
  ```sql
  bucket_id = 'venue-photos'
  ```
- Click **Review** then **Save policy**

### Option B: Via SQL Editor (Faster)

1. Go to Supabase Dashboard → **SQL Editor**
2. **Select your PRODUCTION project**
3. Copy and paste the contents of `scripts/setup-production-storage-policies.sql`
4. Click **Run** (or press Cmd/Ctrl + Enter)
5. Verify policies were created (you should see 4 policies listed)

## Step 4: Verify Environment Variables in Vercel

Ensure these are set in **Vercel Production** environment:

1. Go to Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Filter by **Production** environment
3. Verify these variables exist:
   - `NEXT_PUBLIC_SUPABASE_URL` - Production Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Production Supabase anon key
   - `SUPABASE_SERVICE_ROLE_KEY` - Production Supabase service role key

**Important**: 
- These values may differ from staging if you use separate Supabase projects
- If you just added/updated variables, trigger a new deployment

## Step 5: Verify Setup

### Option A: Using Verification Script

Run the verification script:

```bash
NEXT_PUBLIC_SUPABASE_URL="your-production-supabase-url" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-production-anon-key" \
SUPABASE_SERVICE_ROLE_KEY="your-production-service-role-key" \
npx tsx scripts/verify-production-storage.ts
```

The script will check:
- ✅ Bucket exists
- ✅ Bucket is public
- ✅ Can read from bucket (SELECT policy)
- ✅ Can upload to bucket (INSERT policy)
- ✅ Can generate public URLs

### Option B: Manual Verification

1. Go to production app URL
2. Navigate to `/venue/onboard`
3. Try uploading a photo
4. If successful, you should see the image appear
5. Check Supabase Dashboard → Storage → `venue-photos` to see the uploaded file

## Troubleshooting

### "Bucket not found" error

- Verify bucket name is exactly `venue-photos` (case-sensitive)
- Check you're in the **production** Supabase project (not staging)
- Ensure bucket exists: Storage → Check bucket list

### "Permission denied" or "Policy violation" error

- Verify bucket is set to **Public**
- Check that RLS policies are created (Storage → venue-photos → Policies tab)
- Ensure policies allow `INSERT` and `SELECT` operations
- Try running `scripts/setup-production-storage-policies.sql` again

### "Failed to upload file" error

- Check environment variables in Vercel production
- Verify `NEXT_PUBLIC_SUPABASE_URL` points to production project
- Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` is correct
- Check browser console for detailed error messages
- Ensure bucket policies allow INSERT operation

### Images not displaying

- Verify bucket is **Public**
- Check that SELECT policy exists
- Verify Next.js image config allows `*.supabase.co` domain (see `next.config.js`)
- Check browser console for CORS or image loading errors

### Environment variables not working

- Variables must be set in **Production** environment in Vercel
- After adding variables, trigger a new deployment
- Check Vercel deployment logs for environment variable loading
- Verify variable names match exactly (case-sensitive)

## Production vs Staging

If you have separate Supabase projects for staging and production:

- **Staging**: Already configured (works fine)
- **Production**: Needs setup (this guide)

Make sure you're always working in the correct project:
- Check `NEXT_PUBLIC_SUPABASE_URL` to identify which project you're in
- Production URL will be different from staging URL
- Each project needs its own bucket and policies

## Security Notes

- **Public bucket**: Images are publicly accessible via URL
- **Public policies**: Anyone can upload/read/update/delete (consider restricting if needed)
- **Service role key**: Never expose in client-side code, only use server-side
- **Anon key**: Safe to expose, designed for client-side use

## Related Files

- `scripts/setup-production-storage.ts` - Setup script
- `scripts/setup-production-storage-policies.sql` - SQL policies
- `scripts/verify-production-storage.ts` - Verification script
- `lib/supabase-storage.ts` - Storage helper functions
- `app/api/upload/route.ts` - Upload API route

## Next Steps

After setup:
1. Test photo uploads in production
2. Verify images display correctly
3. Monitor Supabase Storage usage
4. Consider setting up storage limits/alerts if needed
