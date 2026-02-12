-- Production Supabase Storage Policies for venue-photos bucket
-- Run this in your PRODUCTION Supabase project SQL Editor
-- 
-- Instructions:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Select your PRODUCTION project (not staging)
-- 3. Paste this SQL and run it

-- Policy 1: Allow public uploads (INSERT)
-- This allows anyone to upload images to the venue-photos bucket
-- Drop policy if it exists, then create it
DROP POLICY IF EXISTS "Allow public uploads to venue-photos" ON storage.objects;
CREATE POLICY "Allow public uploads to venue-photos"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'venue-photos');

-- Policy 2: Allow public reads (SELECT)
-- This allows anyone to view/download images from the venue-photos bucket
DROP POLICY IF EXISTS "Allow public reads from venue-photos" ON storage.objects;
CREATE POLICY "Allow public reads from venue-photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'venue-photos');

-- Policy 3: Allow public updates (UPDATE)
-- This allows updating existing files (useful for replacing images)
DROP POLICY IF EXISTS "Allow public updates to venue-photos" ON storage.objects;
CREATE POLICY "Allow public updates to venue-photos"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'venue-photos')
WITH CHECK (bucket_id = 'venue-photos');

-- Policy 4: Allow public deletes (DELETE)
-- This allows deleting files from the bucket
DROP POLICY IF EXISTS "Allow public deletes from venue-photos" ON storage.objects;
CREATE POLICY "Allow public deletes from venue-photos"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'venue-photos');

-- Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND policyname LIKE '%venue-photos%'
ORDER BY policyname;
