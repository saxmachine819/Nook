# Phase 0 — Mobile app prerequisites

Complete these before first TestFlight / Play Console upload. Code uses placeholders until credentials are filled in.

## Accounts

| Account | Status | Notes |
|---|---|---|
| Apple Developer Program ($99/yr) | Manual | Needed for App Store Connect, certificates, APNs, Sign in with Apple |
| App Store Connect app record | Manual | Create iOS app with bundle id `io.nooc.app` |
| Google Play Console | Manual | Create app with application id `io.nooc.app` |
| Apple Sign In key | Manual | Services ID + Key → JWT secret for NextAuth `APPLE_*` env vars |
| APNs key (.p8) | Manual | Enable Push Notifications capability; store key id + team id in env |
| Firebase project (FCM) | Manual | Android push; download service account JSON |

## Identity (locked in code)

See [app-identity.json](./app-identity.json).

- **Bundle / application id:** `io.nooc.app`
- **URL scheme:** `nooc://`
- **Universal Links host:** `nooc.io` (+ `staging.nooc.io` for TestFlight)
- **Privacy:** https://nooc.io/privacy
- **Terms:** https://nooc.io/terms
- **Support:** https://nooc.io/support · support@nooc.io

## Env vars to add (Vercel + local)

```bash
# Sign in with Apple (required if Google Sign-In remains — App Store 4.8)
APPLE_ID=com.nooc.app.siwa          # Services ID
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_KEY_ID=XXXXXXXXXX
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
# Or pre-generated client secret JWT:
APPLE_SECRET=

# Push — iOS (APNs)
APNS_KEY_ID=
APNS_TEAM_ID=
APNS_BUNDLE_ID=io.nooc.app
APNS_PRIVATE_KEY=
APNS_PRODUCTION=true

# Push — Android (FCM HTTP v1)
FCM_PROJECT_ID=
FCM_CLIENT_EMAIL=
FCM_PRIVATE_KEY=

# Mobile shell URL override (optional)
NEXT_PUBLIC_MOBILE_APP_URL=https://nooc.io
```

## Privacy nutrition labels (App Store Connect)

Disclose at minimum:

- Contact info (email, name) — account
- Location (coarse/precise) — explore map (Mapbox)
- Purchases — Stripe booking payments
- Identifiers — device push token
- Usage data — Sentry diagnostics (if enabled)
- Diagnostics — crash logs

## Deep link / associated domains

After Team ID / signing cert are known, update:

- `public/.well-known/apple-app-site-association`
- `public/.well-known/assetlinks.json`

Replace `YOUR_APPLE_TEAM_ID`, `YOUR_APPLE_APP_ID_NUMERIC`, and Android SHA-256 fingerprint.

## Checklist before Phase 4 submit

- [ ] Apple Developer membership active
- [ ] App Store Connect record created (`io.nooc.app`)
- [ ] Push + Sign in with Apple capabilities enabled
- [ ] Play Console app created
- [ ] Privacy / Terms / Support URLs live on production
- [ ] Demo customer + venue accounts ready for review
- [ ] APNs + FCM credentials in Vercel env
