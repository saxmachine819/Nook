# Demo video on production (/demo)

The demo video is 62MB and is **gitignored** (`public/demo-video.mov`), so it does not get deployed with the app. Use one of the options below so the video works in production.

---

## Option A: Ship the file with the app (no CDN)

The video is served from your app’s domain at `/demo-video.mov`. You do **not** set `NEXT_PUBLIC_DEMO_VIDEO_URL`; the page uses `/demo-video.mov` by default.

### If you deploy with Vercel

1. **Allow the file to be committed (one-time).**
   - Remove the ignore for the demo video in `.gitignore`:
     - Delete or comment out the line: `public/demo-video.mov`
   - Commit and push the video:
     ```bash
     git add public/demo-video.mov
     git commit -m "Add demo video for /demo page"
     git push
     ```
2. **Deploy.**  
   The next Vercel build will include `public/demo-video.mov`, and the demo page will load it from your site (e.g. `https://yourapp.com/demo-video.mov`).

**Tradeoff:** Repo size grows by ~62MB and stays that way in history. If that’s acceptable, this is the simplest.

### If you deploy elsewhere (e.g. your own server)

1. After each deploy, ensure `public/demo-video.mov` exists in the built app’s `public` folder.
2. Either:
   - Copy it there in your deploy script (e.g. from S3 or a known path), or  
   - Commit the file (as in the Vercel steps above) so it’s part of the build.

No env var is needed for Option A.

---

## Option B: Host the video on a CDN (recommended if you want to keep the repo small)

The video is hosted elsewhere; the app just needs its URL. The demo page reads `NEXT_PUBLIC_DEMO_VIDEO_URL` and uses that for the `<video src>`.

### 1. Upload the video once

Pick one of these (or any storage that gives you a public HTTPS URL):

- **Vercel Blob** (if you’re on Vercel)
  1. In the Vercel dashboard: Project → Storage → Create Database/Blob → follow the flow and get a Blob store.
  2. Upload `public/demo-video.mov` via the dashboard or the [Vercel Blob CLI](https://vercel.com/docs/storage/vercel-blob/using-blob-storage#uploading-files).
  3. Copy the public URL of the uploaded file (e.g. `https://xxx.public.blob.vercel-storage.com/demo-video-xxx.mov`).

- **Cloudflare R2** (S3-compatible, no egress fees)
  1. Create a bucket and make it public (or use a custom domain).
  2. Upload the file; get the public URL (e.g. `https://your-bucket.r2.dev/demo-video.mov` or your custom domain).

- **AWS S3 + CloudFront** (or S3 public bucket)
  1. Create a bucket, upload the file, set object to public (or use CloudFront with origin access).
  2. Use the object URL or the CloudFront URL (e.g. `https://d111111.cloudfront.net/demo-video.mov`).

- **Other:** Any host that serves the file over HTTPS (e.g. Backblaze B2, your own server). You just need a final URL like `https://..../demo-video.mov`.

### 2. Set the URL in production

- **Vercel:** Project → Settings → Environment Variables → add:
  - **Name:** `NEXT_PUBLIC_DEMO_VIDEO_URL`
  - **Value:** the full URL from step 1 (e.g. `https://xxx.public.blob.vercel-storage.com/demo-video-xxx.mov`)
  - Apply to Production (and Preview if you want).

- **Other hosts:** Set the same variable in your production environment (e.g. in your dashboard or `.env.production` if you use it and it’s not committed).

### 3. Redeploy

Trigger a new deploy so the app picks up `NEXT_PUBLIC_DEMO_VIDEO_URL`. The demo page will then use that URL instead of `/demo-video.mov`.

**Tradeoff:** One-time setup to upload and set the env var; repo stays small and deploys stay fast.

---

## Summary

| Option | When to use | You do |
|--------|-------------|--------|
| **A**  | You’re fine committing the 62MB file. | Remove `public/demo-video.mov` from `.gitignore`, commit the file, deploy. Do **not** set `NEXT_PUBLIC_DEMO_VIDEO_URL`. |
| **B**  | You want to keep the repo small. | Upload the video to a CDN (e.g. Vercel Blob), set `NEXT_PUBLIC_DEMO_VIDEO_URL` to that URL in production, redeploy. |

Local dev is unchanged: with the file at `public/demo-video.mov` and no env var, `/demo` uses the local file.
