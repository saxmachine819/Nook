# iOS platform

This Linux CI environment cannot generate the Xcode project (`npx cap add ios` requires macOS).

On a Mac with Xcode installed:

```bash
cd mobile
npm install
npm run build:www
npx cap add ios
npm run cap:sync
npx cap open ios
```

Then enable capabilities in Xcode for `io.nooc.app`:

- Push Notifications
- Sign in with Apple
- Associated Domains (`applinks:nooc.io`, `applinks:staging.nooc.io`)
- Background Modes → Remote notifications (optional)

See [docs/mobile/app-store-submission.md](../docs/mobile/app-store-submission.md).
