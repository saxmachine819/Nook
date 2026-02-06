# Venue Onboarding Testing

## Manual checklist

Use this checklist to verify the venue onboarding flow, including the Welcome page.

### 1. How to reach venue onboarding

- **Profile**: Sign in → Profile → "Add your venue" link
- **Dashboard**: Sign in → Venue Dashboard → "Add venue" (when user has no venues or wants to add another)
- Direct URL: `/venue/onboard` (requires auth; redirects to sign-in if not authenticated)

### 2. Welcome page appears first

- Visit `/venue/onboard` while signed in
- The first screen shown should be "Welcome to Nooc 👋" with:
  - Subtitle: "Let's get your space ready for reservations."
  - Intro text about Nooc
  - 5 numbered steps (Add venue info, Build inventory, Connect Stripe, Submit for approval, Manage bookings & payouts)
  - "Good to know" section with bullets
  - Primary "Continue" button
  - "Contact support" link (mailto:support@nooc.io)
- Progress bar shows "Welcome" as the first/current step

### 3. Clicking Continue advances to Venue Info

- On the Welcome page, click "Continue" (either the button in the content or in the sticky footer)
- User should land on "Venue Information" (name, address, etc.)
- Progress bar should show "Welcome" as past and "Venue Info" as current

### 4. Back button behavior

- From Venue Info (step 1), click "Back" in the sticky footer
- User should return to the Welcome page
- From Welcome (step 0), no Back button should be shown
- From steps 2 or 3, Back should go to the previous step as before

### 5. No console errors, no layout shifts on mobile

- Open DevTools → Console; complete the above flows; verify no errors
- Test on a mobile viewport (or device); verify no layout shifts or overflow issues
- Verify the sticky footer, progress bar, and content scroll correctly
