# Mobile app overview

Nooc ships as a **Capacitor** iOS/Android shell that loads the same Next.js product and Postgres database as the website.

| Doc | Purpose |
|---|---|
| [phase-0-prerequisites.md](./phase-0-prerequisites.md) | Accounts, env vars, bundle IDs |
| [app-identity.json](./app-identity.json) | Canonical IDs and URLs |
| [app-store-submission.md](./app-store-submission.md) | Review notes + submit checklist |
| [demo-accounts.md](./demo-accounts.md) | App Review demo accounts |
| [../../mobile/README.md](../../mobile/README.md) | Capacitor project README |
| [../../mobile/ios/README.md](../../mobile/ios/README.md) | macOS-only iOS Xcode steps |

## Current status

Done in-repo (shared web + Android shell):

- Privacy / Terms / Support live routes
- Sign in with Apple wiring + `jose` client-secret helper
- Device push token API + APNs/FCM send paths
- Capacitor Android project + `cap sync` verified on Linux
- Offline/splash www assets; `/app-shell-preview` embeds the real site
- Vercel previews unblocked (mobile tsconfig exclude + direct `jose` dep)

Still requires a human (credentials / macOS):

1. Apple Developer + App Store Connect app (`io.nooc.app`)
2. Set `APPLE_*`, `APNS_*`, `FCM_*` in Vercel (see [.env.example](../../.env.example))
3. Replace placeholders in `public/.well-known/apple-app-site-association` and `assetlinks.json`
4. On a Mac: `cd mobile && npx cap add ios && npm run cap:sync` → TestFlight ([ios/README](../../mobile/ios/README.md))
5. Create demo customer/venue accounts ([demo-accounts.md](./demo-accounts.md))
6. Apply Prisma model `DevicePushToken` to staging/production (`prisma db push` / migrate) before relying on push

## Architecture

```
App Store / Play Store
        │
   Capacitor shell (mobile/)
   · splash, tabs chrome (web BottomNav + native safe areas)
   · push, share, haptics, biometrics preference, offline cache
        │  WebView → https://nooc.io
        ▼
   Next.js (this repo) ── Prisma ── Postgres
```
