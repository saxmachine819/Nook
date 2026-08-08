# Nooc mobile (Capacitor)

Native shell for iOS + Android that loads the **same** Next.js product at `https://nooc.io` (or staging). Product features ship with the website deploy; this folder only changes for native plugins, permissions, and store metadata.

## Quick start

```bash
cd mobile
npm install
npm run build:www
npx cap add ios      # requires macOS + Xcode
npx cap add android  # requires Android Studio
npm run cap:sync
npm run cap:ios      # or cap:android
```

Override the loaded URL:

```bash
MOBILE_SERVER_URL=https://staging.nooc.io npm run cap:sync
```

## Visual preview (no Xcode)

The app UI **is** the mobile website (Capacitor `server.url` → `https://nooc.io`).
Previews only frame that same UI — they do not invent a second design.

```bash
cd mobile
npm run preview:shell
# http://127.0.0.1:4173/shell-preview.html?src=http://127.0.0.1:3000/
# (or omit ?src= to load https://nooc.io — same mobile UI)
# http://127.0.0.1:4173/  → offline-only fallback (site tokens)
```

Also: `/app-shell-preview` on the Next.js app (iframes `/`).

## Native capabilities (App Store 4.2)

| Feature | Plugin / code |
|---|---|
| Splash + branding | SplashScreen, StatusBar |
| Offline bookings cache | `www/js/offline.js` + web `NativeAppBootstrap` |
| Push notifications | `@capacitor/push-notifications` + `/api/devices/push-token` |
| Share + haptics | `@capacitor/share`, `@capacitor/haptics` |
| Biometrics gate | Preferences + web Settings (Face ID preference) |
| Deep links | `nooc://` + Universal Links / App Links |
| OAuth | `@capacitor/browser` for system browser when needed |

## Docs

- [Phase 0 prerequisites](../docs/mobile/phase-0-prerequisites.md)
- [App Store submission](../docs/mobile/app-store-submission.md)
- [iOS on macOS](./ios/README.md)

## Next steps (human)

1. Add `APPLE_*` / `APNS_*` / `FCM_*` to Vercel (see root `.env.example`).
2. Replace `YOUR_APPLE_TEAM_ID` and Android SHA-256 in `public/.well-known/`.
3. On macOS: follow [ios/README.md](./ios/README.md) → TestFlight.
4. Android Studio: open `mobile/android`, sign, upload internal track AAB.
