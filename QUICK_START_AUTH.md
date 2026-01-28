# Quick Start: Getting Authentication Working

Follow these steps in order:

## Step 1: Update Your Database Schema

Run this command to add the authentication tables to your database:

```bash
npx prisma generate
npx prisma migrate dev --name add_nextauth_tables
```

This creates the `users`, `accounts`, `sessions`, and `verification_tokens` tables.

## Step 2: Set Up Google OAuth (Required)

1. Go to https://console.cloud.google.com/
2. Create a new project (or select existing)
3. Go to "APIs & Services" → "Credentials"
4. Click "Create Credentials" → "OAuth client ID"
5. Choose "Web application"
6. Add these to "Authorized redirect URIs" (click "+ ADD URI" for each):
   ```
   http://localhost:3000/api/auth/callback/google
   http://localhost:3001/api/auth/callback/google
   ```
   (Add both ports so it works whether you run on 3000 or 3001)
7. Copy the "Client ID" and "Client Secret"

## Step 3: Add Environment Variables

Add these lines to your `.env` file:

```env
# NextAuth Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="paste-a-random-secret-here"

# Google OAuth (from Step 2)
GOOGLE_CLIENT_ID="paste-your-client-id-here"
GOOGLE_CLIENT_SECRET="paste-your-client-secret-here"
```

**To generate NEXTAUTH_SECRET**, run this command:
```bash
openssl rand -base64 32
```
Copy the output and paste it as your `NEXTAUTH_SECRET`.

## Step 4: Restart Your Dev Server

Stop your dev server (Ctrl+C) and restart it:

```bash
npm run dev
```

## Step 5: Test It!

1. Go to http://localhost:3000/profile
2. Click "Sign in with Google"
3. Sign in with your Google account
4. You should see your name/email on the profile page
5. Try making a reservation - it should work!

## Optional: Email Magic Link (Skip for now)

If you want email sign-in later, you'll need to configure an email provider. For now, Google sign-in is enough to test.

## Troubleshooting

**"Invalid credentials" error?**
- Double-check your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- Make sure the redirect URI in Google Console matches exactly: `http://localhost:3000/api/auth/callback/google`

**Database errors?**
- Make sure you ran `npx prisma generate` and `npx prisma migrate dev`
- Check that your `DATABASE_URL` in `.env` is correct

**Can't sign in?**
- Make sure your dev server is running
- Check the browser console for errors
- Check the terminal where `npm run dev` is running for errors
