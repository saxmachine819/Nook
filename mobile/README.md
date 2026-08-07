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

```bash
cd mobile
npm run preview:shell
# open http://localhost:4173/shell-preview.html
# offline fallback: http://localhost:4173/
```

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
