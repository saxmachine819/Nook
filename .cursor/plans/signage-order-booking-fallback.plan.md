---
name: ""
overview: ""
todos: []
isProject: false
---

# Signage Order: Feature Flag + Booking Fallback

## Overview

Temporarily disable the Order QR Code Signage wizard and show a dialog with branded copy plus the same Cal.com booking embed used on /demo. Use a **hardcoded constant** (no env var). The existing wizard stays in the codebase; re-enable by flipping the constant to `true` and redeploying.

## Current behavior

- In the venue dashboard, under **QR Code Management**, the **Order signage** button opens `SignageOrderWizard` (state `signageOrderWizardOpen`) in [VenueOpsConsoleClient.tsx](app/venue/dashboard/[id]/VenueOpsConsoleClient.tsx).
- The [/demo](app/demo/page.tsx) page uses a hardcoded Cal.com embed: `https://cal.com/jordan-cohen-3zchhq?embed=true`.

## Approach

### 1. Hardcoded flag (no env var)

In [VenueOpsConsoleClient.tsx](app/venue/dashboard/[id]/VenueOpsConsoleClient.tsx), near the top after imports, add:

```ts
const SIGNAGE_ORDER_WIZARD_ENABLED = false
```

- `true` → current behavior: "Order signage" opens the wizard.
- `false` → "Order signage" opens the new booking dialog (message + Cal embed).

**Re-enabling the full flow later:** Set `SIGNAGE_ORDER_WIZARD_ENABLED = true` and redeploy. No env or config to change.

### 2. Shared Cal.com URL

- Add `lib/cal.ts` exporting the Cal.com embed URL (same as current demo value). Optional: support `NEXT_PUBLIC_CAL_EMBED_URL` override later if desired.
- [app/demo/page.tsx](app/demo/page.tsx): import and use this constant instead of local `CAL_EMBED_URL`.

### 3. Dashboard: "Order signage" click

In VenueOpsConsoleClient:

- Add state for the fallback dialog: `signageBookingDialogOpen`.
- On **Order signage** click:
  - If `SIGNAGE_ORDER_WIZARD_ENABLED` → `setSignageOrderWizardOpen(true)`.
  - Else → `setSignageBookingDialogOpen(true)`.

### 4. Fallback dialog

When the flag is `false` and the user clicks Order signage:

- Use existing `Dialog` + `DialogContent` pattern in the file.
- **Copy (branded):** e.g. *"We're working on self-serve signage ordering. Until then, book a short call and we'll get you set up with everything you need."*
- Below: same Cal.com embed as demo (iframe, min height ~380px, using shared URL).

### 5. Wizard unchanged

- Keep `SignageOrderWizard` rendered as today; only the **button** behavior changes based on the constant.
- No removal or conditional mounting of the wizard — flipping the constant back to `true` restores the full flow.

## Files to change


| File                                                                                                     | Change                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New: `lib/cal.ts`                                                                                        | Export Cal embed URL.                                                                                                                                         |
| [app/demo/page.tsx](app/demo/page.tsx)                                                                   | Import Cal URL from `lib/cal.ts`; remove local `CAL_EMBED_URL`.                                                                                               |
| [app/venue/dashboard/[id]/VenueOpsConsoleClient.tsx](app/venue/dashboard/[id]/VenueOpsConsoleClient.tsx) | Add `SIGNAGE_ORDER_WIZARD_ENABLED = false`; add `signageBookingDialogOpen` state and dialog (message + iframe); branch "Order signage" click on the constant. |


## Rollback

Set `SIGNAGE_ORDER_WIZARD_ENABLED = true` in VenueOpsConsoleClient and redeploy. No env var or config change required.