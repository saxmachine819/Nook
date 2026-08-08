# App Store / Play Store submission

## Review notes (paste into App Store Connect)

```
Nooc is a marketplace for reserving physical workspace seats by the hour
(coffee shops, hotel lobbies, etc.). Customers browse venues, book seats, and
manage reservations. Venue operators manage inventory and check-ins.

This is NOT a website wrapper. Native capabilities beyond Safari:

1. Push notifications — booking reminders (60 min), end-of-booking alerts,
   venue new-booking alerts (APNs / FCM via Capacitor Push Notifications).
2. Offline access — upcoming reservations cached on-device; branded offline
   screen when the network is unavailable.
3. Sign in with Apple — offered alongside Google (Guideline 4.8).
4. In-app account deletion — Profile → Delete account.
5. Biometric unlock preference — Face ID / biometric gate (Preferences).
6. Native share sheet + haptics on venue share / interactions.
7. Deep links — nooc:// scheme + Universal Links / App Links for
   /reservations, /venue/*, /profile.
8. Location — used for the explore map (Mapbox) with a clear purpose string.

Payments: Stripe Checkout for physical seat reservations (real-world service).
Apple Pay is supported via Stripe Payment Method Domains. These are not digital
goods and are not subject to IAP.

Demo account (same account covers both roles):
- Sign in with Google using nooc.demo@gmail.com (password in App Review notes /
  private credential store — this account has no separate app password).
- Customer role: has an upcoming reservation visible immediately after sign-in.
- Venue role: open the Manage tab to reach the "Nooc Demo Café" venue dashboard
  (seats, bookings) — this account is an admin member of that venue.

Privacy: https://nooc.io/privacy
Terms: https://nooc.io/terms
Support: https://nooc.io/support · support@nooc.io
```

## Pre-submit checklist

### iOS (TestFlight → App Store)
- [ ] `cd mobile && npm i && npm run cap:add:ios && npm run cap:sync` on macOS
- [ ] Xcode: signing team, Push Notifications + Associated Domains + Sign in with Apple capabilities
- [ ] Associated Domains: `applinks:nooc.io`, `applinks:staging.nooc.io`
- [ ] Replace Team ID in `public/.well-known/apple-app-site-association`
- [ ] Archive → upload → TestFlight internal
- [ ] Paste review notes; attach screenshots of Sign in with Apple + Delete account
- [ ] Submit for review

### Android (internal track → production)
- [ ] `cd mobile && npm run cap:add:android && npm run cap:sync` (android already scaffolded in repo)
- [ ] Replace SHA-256 in `public/.well-known/assetlinks.json`
- [ ] Upload AAB to Play Console internal testing
- [ ] Complete Data safety form (matches Privacy Policy)
- [ ] Promote when iOS is approved (or in parallel)

## Screenshots to capture

1. Explore map (first viewport)
2. Venue detail with Share
3. Sign-in screen showing **Continue with Apple** + Google
4. Profile → Delete account dialog
5. Reservations list
6. Venue Manage dashboard (venue demo account)
7. Native shell offline screen (`mobile/www/index.html`)
8. Push permission prompt (device)

## Demo accounts

Single Google account, seeded with both roles in the production database:

| Email | Notes |
|---|---|
| nooc.demo@gmail.com | Customer: 1 upcoming reservation. Venue: admin member of "Nooc Demo Café" (approved, 1 table/seat). |

Google account password stored in 1Password (not in this repo) — paste it into
the App Store Connect review notes field alongside the block above before submitting.

## Binary update cadence

Ship product changes via Vercel (website). Rebuild the native binary only when plugins, permissions, icons, or store metadata change.
