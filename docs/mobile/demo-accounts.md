# Demo accounts for App Review

Fill these before TestFlight / Play submission and paste into App Review notes ([app-store-submission.md](./app-store-submission.md)).

| Role | Suggested email | Setup steps |
|---|---|---|
| Customer | `demo-customer@nooc.io` | Sign in (Apple or Google). Create ≥1 upcoming reservation at an approved venue. |
| Venue | `demo-venue@nooc.io` | Own an approved venue with seats/tables. Confirm Manage tab opens the dashboard. |

Store credentials in a private vault. Do **not** commit passwords to git.

## Manual verify checklist (this PR)

- [x] `/privacy`, `/terms`, `/support` render
- [x] `/profile` shows Continue with Apple + Continue with Google
- [x] `/app-shell-preview` shows native shell chrome
- [x] `mobile/www` offline + shell preview serve on :4173
- [x] Push token API unit tests pass
- [x] Vercel preview builds succeed (deploy fix landed)
- [x] `npx cap sync android` succeeds on Linux
- [ ] Apple Developer / Play Console accounts (human)
- [ ] APNs + FCM + APPLE_SECRET in Vercel (human)
- [ ] Replace Team ID / SHA-256 in `.well-known` association files (human)
- [ ] `npx cap add ios` on macOS + TestFlight upload (human)
- [ ] Demo customer + venue accounts created + passwords vaulted (human)
