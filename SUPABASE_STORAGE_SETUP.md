# Supabase Storage Setup Guide

This guide explains how to set up Supabase Storage for photo uploads in the venue onboarding flow.

## Prerequisites

1. A Supabase project (already set up for database)
2. Access to Supabase Dashboard

## Step-by-Step Setup

### Step 1: Create Storage Bucket

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Navigate to **Storage** in the left sidebar
4. Click **New bucket** button
5. Configure the bucket:
   - **Name**: `venue-photos` (must be exactly this name)
   - **Public bucket**: ✅ **Enable this** (makes images publicly accessible via URL)
   - **File size limit**: 5MB (recommended, or adjust as needed)
   - **Allowed MIME types**: Leave empty (allows all image types) OR enter `image/*`

6. Click **Create bucket**

**Important**: The bucket name must be exactly `venue-photos` as the code references this specific name.

### Step 2: Get Your API Keys

1. In Supabase Dashboard, go to **Settings** → **API**
2. You'll see several keys. Copy these values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (starts with `eyJ...`)

### Step 3: Add Environment Variables

Add these to your `.env` file (in the project root):

```bash
# Supabase Storage (required for photo uploads)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Example `.env` file:**
```bash
# Database (already configured)
DATABASE_URL=postgresql://...

# Supabase Storage
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0NTIzNDU2NywiZXhwIjoxOTYwODEwNTY3fQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Important Notes:**
- `NEXT_PUBLIC_` prefix means these are exposed to the browser (safe for public keys)
- Never commit your `.env` file to git
- The `anon` key is safe to expose - it's designed for client-side use

### Step 4: Verify Setup

1. **Restart your development server** (required to load new env vars):
   ```bash
   # Stop the server (Ctrl+C) then:
   npm run dev
   ```

2. Navigate to `/venue/onboard` in your browser
3. Create a table or seat
4. Click the **Upload** button next to "Table Photos" or "Seat Photos"
5. Select an image file
6. You should see:
   - A success toast: "Image uploaded successfully"
   - The image appear in the preview grid
7. **Verify in Supabase Dashboard**:
   - Go to **Storage** → `venue-photos`
   - You should see folders like `table/` and `seat/` with your uploaded images

## File Structure

Uploaded files are organized as:
```
venue-photos/
  ├── table/
  │   └── <table-id>/
  │       └── <timestamp>-<random>.jpg
  └── seat/
      └── <seat-id>/
          └── <timestamp>-<random>.jpg
```

## Troubleshooting

### Upload fails with "Bucket not found"
- Verify the bucket name is exactly `venue-photos`
- Check that the bucket exists in your Supabase Dashboard

### Upload fails with "Permission denied"
- If using a public bucket: Ensure `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set correctly
- If using a private bucket: Ensure `SUPABASE_SERVICE_ROLE_KEY` is set and policies are configured

### Images not displaying
- Check that the bucket is set to **Public**
- Verify the returned URL is accessible
- Check browser console for CORS errors

### File size errors
- Default limit is 5MB per file
- Increase limit in bucket settings if needed
- Or reduce image size before upload

## Fallback: URL Input

If Supabase Storage is not configured, users can still add photos via URL input. The upload button will be disabled, but the URL input field will work.

## Security Notes

- **Public bucket**: Images are publicly accessible via URL. Anyone with the URL can view the image.
- **Private bucket**: Requires authentication and proper RLS policies.
- **Service role key**: Never expose this in client-side code. Only use in server-side API routes if needed.
