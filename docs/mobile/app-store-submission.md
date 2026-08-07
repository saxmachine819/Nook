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

Demo accounts:
- Customer: [FILL_CUSTOMER_EMAIL] / use Sign in with Apple or Google as provided
- Venue: [FILL_VENUE_EMAIL] — after sign-in, open Manage tab → venue dashboard

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

Create before submission and document credentials in a private 1Password note + App Review notes:

| Role | Email | Notes |
|---|---|---|
| Customer | demo-customer@nooc.io | At least one upcoming reservation |
| Venue | demo-venue@nooc.io | Owns an approved venue with seats |

## Binary update cadence

Ship product changes via Vercel (website). Rebuild the native binary only when plugins, permissions, icons, or store metadata change.
