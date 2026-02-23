---
name: ""
overview: ""
todos: []
isProject: false
---

# Email Debug: Manual "Run dispatcher" button only

## Scope

Add a single **"Run dispatcher"** button on the Email Debug admin page that lets admins manually process the pending email queue (e.g. on staging). No "send one" per-row button in this build.

---

## Why this does not interfere with existing email flows

- **No changes to existing code paths**
  - `[app/api/email/dispatch/route.ts](app/api/email/dispatch/route.ts)` is unchanged. Cron (GET with `CRON_SECRET`) and external POST (with `x-dispatch-secret`) continue to work exactly as today.
  - `[lib/email-dispatch.ts](lib/email-dispatch.ts)` is unchanged. We do not modify `runDispatcher()` or any enqueue logic.
- **Additive only**
  - New route is a separate endpoint: `POST /api/admin/email/run-dispatcher`. It uses session + `isAdmin()`, then calls the same `runDispatcher()`. So we are just adding another **caller** of the same function the cron uses.
- **Same behavior**
  - `runDispatcher()` still processes up to 25 PENDING events, sends via Resend, and marks them SENT or FAILED. Enqueue flows (reservations, venue approve, welcome, reminder crons, etc.) are untouched and keep writing to `NotificationEvent` as they do now.
- **Rare edge case**
  - If the cron and the admin button run at the same time, both could call `runDispatcher()` and each might see the same PENDING events, so a few emails could be sent twice. This is uncommon (cron runs every minute; manual click is occasional) and for staging is usually acceptable. If you want to avoid that entirely, we can add a simple lock (e.g. short-lived "dispatcher running" flag in DB or in-memory) in a follow-up; not required for this scope.

---

## Implementation

### 1. New API route: `POST /api/admin/email/run-dispatcher`

- **File:** `app/api/admin/email/run-dispatcher/route.ts`
- **Auth:** `auth()` from `@/lib/auth`; if no session or `!isAdmin(session.user)`, return 401.
- **Action:** Call `runDispatcher()` from `@/lib/email-dispatch`. Return JSON:
  - Success: `200` with `{ processed, sent, failed }`.
  - Env error (e.g. missing Resend config): `500` with `{ error: result.envError, processed, sent, failed }` so the UI can show "Email not configured" instead of a generic error.
- **No changes** to `lib/email-dispatch.ts` or to the existing `/api/email/dispatch` route.

### 2. Email Debug UI

- **File:** `[app/(root)/admin/email-debug/EmailDebugClient.tsx](app/(root)`/admin/email-debug/EmailDebugClient.tsx)
  - Add a **"Run dispatcher"** button (e.g. next to the filters or above the table).
  - On click:
    - `POST /api/admin/email/run-dispatcher` (no body needed).
    - Show loading state on the button while the request is in flight.
    - On success: show a short message with the result (e.g. "Processed 5, sent 5, failed 0") and call `router.refresh()` so the table updates (PENDING → SENT).
    - On error: show the error message (e.g. "Email not configured: ..." or "Unauthorized").
  - No new props from the server page; the client already has `router` and can trigger refresh.
- **File:** `[app/(root)/admin/email-debug/page.tsx](app/(root)`/admin/email-debug/page.tsx)
  - No changes required; the new button lives in the client component.

---

## Files to add or change


| Action | File                                                                                                                                       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Add    | `app/api/admin/email/run-dispatcher/route.ts` — session + isAdmin, call runDispatcher(), return result                                     |
| Edit   | `app/(root)/admin/email-debug/EmailDebugClient.tsx` — add "Run dispatcher" button, fetch POST, result message, router.refresh() on success |


---

## Summary

- Only addition is an admin-only route and a button that calls the same `runDispatcher()` the cron uses. Existing email flows (enqueue + cron dispatch) are unchanged and will not be interfered with.

