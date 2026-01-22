# Setup Supabase Bucket Policy for Public Uploads

Since you're using the anon key, you need to configure the bucket to allow public uploads.

## Option A: Via Supabase Dashboard (Easiest)

1. Go to https://app.supabase.com
2. Select your project
3. Navigate to **Storage** → `venue-photos` bucket
4. Click the **Policies** tab
5. Click **New Policy**
6. Choose **For full customization**
7. Configure:
   - **Policy name**: `Allow public uploads`
   - **Allowed operation**: `INSERT`
   - **Policy definition**: 
     ```sql
     true
     ```
8. Click **Review** then **Save policy**

## Option B: Via SQL Editor

1. Go to Supabase Dashboard → **SQL Editor**
2. Run this SQL:

```sql
-- Allow public uploads to venue-photos bucket
CREATE POLICY "Allow public uploads"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'venue-photos');
```

## Verify

After setting up the policy, try uploading again. The upload should work with the anon key.
