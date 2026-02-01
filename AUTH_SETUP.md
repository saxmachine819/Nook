# Authentication Setup Guide

This project uses NextAuth.js (Auth.js) v5 with Prisma adapter for authentication.

## Prerequisites

1. **Database**: Ensure your PostgreSQL database is running and accessible via `DATABASE_URL`
2. **Google OAuth**: Set up a Google OAuth application (required for Google sign-in)
3. **Email Provider**: Optional, but recommended for magic link authentication

## Environment Variables

Copy `.env.example` to `.env` and fill in the following variables:

### Required

- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_URL`: Your application URL (e.g., `http://localhost:3000` for development)
- `NEXTAUTH_SECRET`: Secret key for JWT encryption (generate with: `openssl rand -base64 32`)
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret

### Optional (for Email Magic Link)

- `EMAIL_SERVER`: SMTP server configuration (see examples in `.env.example`)
- `EMAIL_FROM`: Email address to send from

### Local vs Production (Supabase + Vercel)

- **Local:** Use Supabase **connection pooler** for `DATABASE_URL` (port 6543, from Dashboard → Settings → Database → Connection pooling). OAuth in development uses `http://localhost:3000` automatically. Add `?sslmode=require` to `DATABASE_URL` if connection fails.
- **Vercel (production):** Change nothing. Use whatever `DATABASE_URL` you already have; no `DIRECT_URL` or other env changes required. Set `NEXTAUTH_URL` to your production URL (e.g. `https://your-app.vercel.app`).

## Database Migration

After setting up environment variables, run Prisma migrations to create the auth tables:

```bash
# Generate Prisma client with new auth models
npx prisma generate

# Create and apply migration
npx prisma migrate dev --name add_nextauth_tables

# Or if you prefer to push schema without migration history:
npx prisma db push
```

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth client ID"
5. Choose "Web application"
6. Add authorized redirect URIs (click "+ ADD URI" for each):
   - `http://localhost:3000/api/auth/callback/google` (for development on port 3000)
   - `http://localhost:3001/api/auth/callback/google` (for development on port 3001)
   - `https://yourdomain.com/api/auth/callback/google` (for production)
7. Copy the Client ID and Client Secret to your `.env` file

## Email Provider Setup (Optional)

Choose one of the following email providers:

### Option 1: SMTP Server
Use any SMTP server:
```
EMAIL_SERVER="smtp://username:password@smtp.example.com:587"
EMAIL_FROM="noreply@example.com"
```

### Option 2: SendGrid
1. Sign up for [SendGrid](https://sendgrid.com/)
2. Create an API key
3. Use the SMTP configuration:
```
EMAIL_SERVER="smtp://apikey:YOUR_API_KEY@smtp.sendgrid.net:587"
EMAIL_FROM="noreply@yourdomain.com"
```

### Option 3: AWS SES
1. Set up AWS SES
2. Create SMTP credentials
3. Use the SMTP configuration:
```
EMAIL_SERVER="smtp://SMTP_USERNAME:SMTP_PASSWORD@email-smtp.region.amazonaws.com:587"
EMAIL_FROM="noreply@yourdomain.com"
```

## Testing Locally

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Test Google Sign-In:**
   - Navigate to `/profile`
   - Click "Sign in with Google"
   - Complete the OAuth flow
   - Verify you're signed in

3. **Test Email Magic Link (if configured):**
   - Navigate to `/profile`
   - Click "Sign in with Email"
   - Enter your email address
   - Check your email for the magic link
   - Click the link to sign in

4. **Test Reservations:**
   - After signing in, try making a reservation
   - Verify it's associated with your user account
   - Check `/reservations` to see your reservations

## Troubleshooting

### "Invalid credentials" error
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Check that redirect URIs match exactly in Google Cloud Console

### "Email not sent" error
- Verify `EMAIL_SERVER` and `EMAIL_FROM` are configured correctly
- Check SMTP server logs
- Ensure email provider allows sending from your domain

### Database errors
- Run `npx prisma generate` to regenerate Prisma client
- Verify `DATABASE_URL` is correct (local: use pooler; production: no change needed)
- If local connection fails, add `?sslmode=require` to `DATABASE_URL`
- Check that migrations have been applied: `npx prisma migrate status`

### Session not persisting
- Verify `NEXTAUTH_SECRET` is set
- Check that cookies are enabled in your browser
- Ensure `NEXTAUTH_URL` matches your actual URL

## Security Notes

- Never commit `.env` file to version control
- Use strong, randomly generated `NEXTAUTH_SECRET`
- In production, use HTTPS and secure cookies
- Regularly rotate OAuth credentials
