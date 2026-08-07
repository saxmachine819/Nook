# Mobile app overview

Nooc ships as a **Capacitor** iOS/Android shell that loads the same Next.js product and Postgres database as the website.

| Doc | Purpose |
|---|---|
| [phase-0-prerequisites.md](./phase-0-prerequisites.md) | Accounts, env vars, bundle IDs |
| [app-identity.json](./app-identity.json) | Canonical IDs and URLs |
| [app-store-submission.md](./app-store-submission.md) | Review notes + submit checklist |
| [../../mobile/README.md](../../mobile/README.md) | Capacitor project README |

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
