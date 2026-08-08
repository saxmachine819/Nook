# Demo accounts for App Review

See [app-store-submission.md](./app-store-submission.md) for the actual review-notes text.

One Google account covers both roles: `nooc.demo@gmail.com`, seeded directly in
production with an upcoming reservation (customer) and admin membership on the
"Nooc Demo Café" venue (venue operator, Manage tab). Password stored in a
private vault, not in git.

## Manual verify checklist

- [x] `/privacy`, `/terms`, `/support` render
- [x] `/profile` shows Continue with Apple + Continue with Google
- [x] `/app-shell-preview` shows native shell chrome
- [x] `mobile/www` offline + shell preview serve on :4173
- [x] Push token API unit tests pass
- [x] Vercel preview builds succeed (deploy fix landed)
- [x] `npx cap sync android` succeeds on Linux
- [x] Apple Developer / Play Console accounts (human)
- [x] APNs + FCM + APPLE_SECRET in Vercel (Apple done; FCM/Android still pending)
- [x] Replace Team ID / SHA-256 in `.well-known` association files (Team ID done; Android SHA-256 still pending)
- [x] `npx cap add ios` on macOS + TestFlight upload (human)
- [x] Demo account created + password vaulted (human)
