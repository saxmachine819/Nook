# Email test contract

## Preview Checklist

### How to run preview

1. From the project root, run: `npm run email:dev`
2. Open http://localhost:3001 in your browser (or the port shown in the terminal if different).

Preview runs locally and does not require Resend API keys or any external services.

### How to confirm the template renders

1. In the email preview UI, select **WelcomeEmail** from the list of templates.
2. Confirm the email loads without errors and the layout is visible.

### What to look for

- **Layout:** Header, body copy, primary button, and footer are present; no broken sections or horizontal overflow.
- **Button:** The primary CTA (“Explore venues”) is visible, uses the dark green style, and the link matches the configured `ctaUrl` (in preview, the mocked value).
- **Footer:** “support@nooc.io” (or “Reply to support@nooc.io”) is present and readable at the bottom.

### Mocked props for preview

WelcomeEmail uses default props so the preview works without any external data. Example values:

| Prop      | Example value        | Purpose                    |
| --------- | -------------------- | -------------------------- |
| `userName`| `"Alex"`             | Greeting in the body copy  |
| `ctaUrl`  | `"https://nooc.io"`  | Primary button link        |

These defaults are defined in `emails/WelcomeEmail.tsx`. When previewing, the template renders with these values unless overridden in the preview UI.

---

## Send endpoint (curl)

The send endpoint is **server-side only**. It never returns or logs `RESEND_API_KEY` or any secret. In production the endpoint is **disabled** unless `ENABLE_EMAIL_SEND_IN_PRODUCTION=true` is set.

### Example curl

```bash
curl -X POST http://localhost:3000/api/email/send \
  -H "Content-Type: application/json" \
  -d '{"to":"you@example.com"}'
```

Optional body fields: `userName`, `ctaUrl` (e.g. `{"to":"you@example.com","userName":"Jordan","ctaUrl":"https://nooc.io"}`).

### 1. Success case

- Set `RESEND_API_KEY` (from Resend dashboard) and `EMAIL_FROM=support@nooc.io` in `.env`.
- Start the app (`npm run dev`), then run the curl above with a real `to` address you can receive at.
- **Expected:** `200` and body `{ "ok": true, "id": "..." }`. No API key or secret in the response.

### 2. Missing RESEND_API_KEY

- Unset or leave `RESEND_API_KEY` empty in `.env`. Keep `EMAIL_FROM=support@nooc.io`.
- Run the same curl.
- **Expected:** `500` and body `{ "error": "Email service is not configured." }` (or similar). The response must **not** contain the key, "re_", or any secret.

### 3. Production safety

- With `NODE_ENV=production` and **without** `ENABLE_EMAIL_SEND_IN_PRODUCTION=true`, run the same curl (e.g. against a production build or with `NODE_ENV=production`).
- **Expected:** `404` and body `{ "error": "Not available" }`. The send endpoint must not run in production unless explicitly enabled.

---

## NotificationEvent and dedupe

`enqueueNotification` (in `lib/notification-queue.ts`) enqueues a notification event and is **idempotent by dedupeKey**: enqueueing with the same `dedupeKey` twice results in only one row; the second call returns `{ created: false, id }` and does not create a new row.

### How to run the test

From the project root:

```bash
npm run test -- __tests__/lib/notification-queue.test.ts
```

### Expected behavior

- **Same dedupeKey enqueued twice:** First call returns `{ created: true, id: "..." }` and creates one row. Second call with the same `dedupeKey` returns `{ created: false, id: "..." }` and does **not** create a second row.
- **Different dedupeKey:** Enqueueing with a different `dedupeKey` creates a new row and returns `{ created: true, id: "..." }`. So two distinct keys yield two rows (two `created: true` responses).

---

## Dispatcher (seed and dispatch)

The dispatcher processes up to 25 `PENDING` notification events: sends email via Resend, then updates each to `SENT` (with `sentAt`) or `FAILED` (with `error` string). In production, the dispatch endpoint requires the `x-dispatch-secret` header to match `DISPATCH_SECRET`.

### Seed one pending event (local dev)

From the project root, create one PENDING event (type `welcome`) so you can test dispatch:

```bash
npx tsx scripts/seed-one-pending-notification.ts you@example.com
```

Omit the email to use `SEED_EMAIL` from `.env`, or a default placeholder. The script refuses to run when `NODE_ENV=production`. It logs the created event id.

### Run dispatch (curl)

**Local (no secret required):**

```bash
curl -X POST http://localhost:3000/api/email/dispatch -H "Content-Type: application/json"
```

**Production (secret required):**

```bash
curl -X POST https://your-app.com/api/email/dispatch \
  -H "Content-Type: application/json" \
  -H "x-dispatch-secret: YOUR_DISPATCH_SECRET"
```

**Expected response:** `200` and body `{ "processed", "sent", "failed" }`. If Resend env is invalid, `500` with `error` and counts.

### Verify status transitions and failed error

1. **SENT:** Seed a pending event with your email, run dispatch with valid `RESEND_API_KEY` and `EMAIL_FROM`. Check the `notification_events` row: `status` = `SENT`, `sentAt` set, `error` null. Optionally confirm receipt in inbox.
2. **FAILED:** Create a PENDING event with an unknown `type` (e.g. manually in DB or a test), run dispatch. Check the row: `status` = `FAILED`, `error` = "Unknown event type". Or unset `RESEND_API_KEY` and run dispatch: events should be marked FAILED with an error message captured in `error`.

---

## Delivery within ~1 minute (cron)

In production, **Vercel Cron** runs every 1 minute and calls GET `/api/email/dispatch`, GET `/api/cron/booking-end-reminders`, and GET `/api/cron/booking-reminder-60min`, each with `Authorization: Bearer CRON_SECRET`. All endpoints reject requests with a missing or invalid secret (401). See **Vercel Cron setup and CRON_SECRET** below for exact env vars and Vercel setup.

Booking creation only **enqueues** a notification; it does not wait on sending. So **booking request latency** is not increased by email—only by the enqueue DB write, which is small.

### How to validate

- **Booking latency:** Create a booking (e.g. from the app or via API); confirm the response returns in the same order of magnitude as before (no extra second(s) for email). The only extra work on the request path is the enqueue write.
- **Email arrival (local):** After creating a booking, run `curl -X POST http://localhost:3000/api/email/dispatch -H "x-dispatch-secret: YOUR_SECRET"` (or trigger dispatch once); confirm the confirmation email is received and the corresponding `NotificationEvent` row is SENT.
- **Email arrival (production):** Rely on the 1-minute cron; create a booking and confirm the email arrives within about 1 minute.

---

## Vercel Cron setup and CRON_SECRET

### Exact env vars

- **CRON_SECRET** (required in Vercel): Used by Vercel Cron to authenticate GET requests to both cron endpoints. Set in Vercel: Project → Settings → Environment Variables. Can match `DISPATCH_SECRET` or be a separate secret only Vercel cron knows.
- **DISPATCH_SECRET**: Used for manual POST to `/api/email/dispatch` (header `x-dispatch-secret`). Optional for cron if you use GET with CRON_SECRET.
- **Optional (local/testing):** `BOOKING_REMINDER_WINDOW_START_MINUTES`, `BOOKING_REMINDER_WINDOW_END_MINUTES` — default 4 and 6; override to e.g. 1 and 3 for local testing of booking-end reminders.
- **Optional (local/testing):** `BOOKING_REMINDER_60MIN_WINDOW_START`, `BOOKING_REMINDER_60MIN_WINDOW_END` — default 54 and 66; override to e.g. 1 and 3 for local testing of 60-minute booking reminders.

### Vercel setup steps

1. In Vercel: Project → Settings → Environment Variables. Add **CRON_SECRET** (e.g. same value as `DISPATCH_SECRET`) for Production (and Preview if you want cron in preview).
2. Cron jobs are defined in `vercel.json`; no UI step required. After deploy, all run every 1 minute:
   - GET `/api/email/dispatch` — sends queued notification emails.
   - GET `/api/cron/booking-end-reminders` — enqueues 5-minute booking-end reminder emails for reservations ending soon.
   - GET `/api/cron/booking-reminder-60min` — enqueues 60-minute booking reminder emails for reservations starting soon.

### Local testing with secret header

Set `CRON_SECRET` in `.env` (e.g. `CRON_SECRET=your-local-secret`).

**Dispatch (GET):**

```bash
curl -H "Authorization: Bearer your-local-secret" http://localhost:3000/api/email/dispatch
```

Expected: `200` and body `{ "processed", "sent", "failed" }`.

**Booking end reminders (GET):**

```bash
curl -H "Authorization: Bearer your-local-secret" http://localhost:3000/api/cron/booking-end-reminders
```

**Booking 60min reminders (GET):**

```bash
curl -H "Authorization: Bearer your-local-secret" http://localhost:3000/api/cron/booking-reminder-60min
```

Expected for both: `200` and body `{ "enqueued", "skipped" }`.

**Missing or wrong secret:** Omit the header or use a wrong token. Expected for all cron endpoints: **401** and body `{ "error": "Unauthorized" }`.

### Production: reject missing/invalid secret

In production, GET requests to any cron endpoint without `Authorization: Bearer <CRON_SECRET>` or with an incorrect token must return **401** and body `{ "error": "Unauthorized" }`. This is already implemented. To confirm: run `curl https://your-production-url.com/api/email/dispatch`, `curl https://your-production-url.com/api/cron/booking-end-reminders`, and `curl https://your-production-url.com/api/cron/booking-reminder-60min` (no header); all should return 401.

---

## Booking reminder 60min

The cron endpoint `/api/cron/booking-reminder-60min` enqueues `booking_reminder_60min` notification events for active reservations whose `startAt` falls within a window (default: 54–66 minutes from now). Events use `dedupeKey: booking_reminder_60min:<bookingId>` and are idempotent.

### A) Local queue test

1. Set `BOOKING_REMINDER_60MIN_WINDOW_START=1` and `BOOKING_REMINDER_60MIN_WINDOW_END=3` in `.env`.
2. Create a booking starting in ~2 minutes (or adjust your system clock / mock data).
3. Hit the cron endpoint: `curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/booking-reminder-60min`.
4. Verify exactly one `NotificationEvent` row with `type` = `booking_reminder_60min` and `dedupeKey` = `booking_reminder_60min:<reservationId>`.

### B) Dedupe test

1. With a booking in the window, call the cron endpoint twice.
2. Confirm only one `NotificationEvent` row exists per `bookingId` (same `dedupeKey`; second enqueue returns `created: false`).

### C) Dispatch test

1. Seed or enqueue a PENDING `booking_reminder_60min` event (or rely on the cron).
2. Run `curl -X POST http://localhost:3000/api/email/dispatch` (or GET with CRON_SECRET).
3. Confirm the reminder email is received with subject "Your Nooc booking starts in 1 hour" and that the row moves to SENT.

### D) Link test

1. Receive a reminder email and click **View Booking**.
2. Confirm the link opens the venue page with correct seat/table context: `resourceType`, `resourceId`, and `booking` params in the URL, matching the QR deep-link format.

---

## Email Debug Panel

The Email Debug panel is a **read-only** admin page that lists recent `NotificationEvent` rows (last 100, newest first). It does not send, retry, edit, or delete events. Access is restricted to admins (see **Admin-only** below).

### How to access locally

1. Set **ADMIN_EMAILS** in `.env` to a comma-separated list of admin emails (e.g. `ADMIN_EMAILS=you@example.com`).
2. Sign in as a user whose email is in `ADMIN_EMAILS`.
3. Go to **Admin** (e.g. `/admin`) and click **Email Debug**, or open `http://localhost:3000/admin/email-debug` directly.

### Admin-only

When not signed in, or when signed in as a user whose email is **not** in `ADMIN_EMAILS`, opening `/admin/email-debug` shows **"Not authorized"** (same card as other admin pages). The event list is not shown. Ensure `ADMIN_EMAILS` is set and your test user’s email is in that list.

### What the panel reflects

- **Newly queued events:** After creating a booking (or enqueueing via seed script), events appear with status **PENDING**. Filter by status = PENDING to see them.
- **Dispatched events:** After running the dispatch endpoint (or cron), processed events move to **SENT** and show a `sentAt` timestamp. Filter by status = SENT.
- **Failed events:** Events that fail to send (e.g. unknown type, Resend error) are marked **FAILED** and show an error message in the expanded row. Filter by status = FAILED.

You can also filter by **type** (e.g. `booking_confirmation`, `welcome_user`, `booking_end_5min`, `booking_reminder_60min`). Click a row to expand and view derived subject, pretty-printed payload, error (if failed), and sentAt (if sent).

### Manual test checklist

1. Set `ADMIN_EMAILS` in `.env` and sign in as an admin user.
2. Open **Email Debug** (`/admin/email-debug`). Confirm the list loads (may be empty).
3. Filter by **Status** (e.g. PENDING) and **Type** (e.g. booking_confirmation). Confirm the URL updates and the table shows only matching events.
4. Click a row to expand. Confirm **Subject (derived)**, **Payload** (pretty-printed JSON), and, when applicable, **Error** (for FAILED) and **Sent at** (for SENT).
5. Sign out or use a non-admin account. Open `/admin/email-debug`. Confirm **"Not authorized"** is shown and no event list is visible.

---

## Booking confirmation enqueue (manual)

After a successful booking, the reservations API enqueues one `booking_confirmation` notification (enqueue only; no inline send).

### Manual checklist

1. **Create a booking via the app UI** (signed-in user with an email on file).
2. **Verify exactly one NotificationEvent row** in the database:
   - `type` = `booking_confirmation`
   - `dedupeKey` = `booking_confirmation:<reservationId>` (use the created reservation’s id).
3. **Optional:** Run the dispatch endpoint and confirm the email is sent and the row’s status moves to SENT.

### Automated test (if implemented)

- **Success:** A test that mocks `enqueueNotification` and asserts it is called once with `type: "booking_confirmation"`, `dedupeKey` matching `/^booking_confirmation:/`, and `toEmail` equal to the session user’s email after a 201 response.
- **Failure:** A test that triggers a failed booking (e.g. missing fields, 400/409) and asserts `enqueueNotification` is not called.

---

## Venue approved email

When a site admin approves a venue (POST `/api/venues/[id]/approve`), the venue owner receives an "Approved & Ready to Book" email. The notification is enqueued only after approval succeeds; it uses `type: venue_approved` and `dedupeKey: venue_approved:<venueId>` for idempotency.

### A) Manual test

1. As an admin, approve a venue with a known name (e.g. "Bluebird Café") from the Admin → Approvals page (or via POST `/api/venues/<venueId>/approve`).
2. Verify exactly one `NotificationEvent` row: `type` = `venue_approved`, `dedupeKey` = `venue_approved:<venueId>`, and payload containing `venueName`, `venueId`, and `dashboardUrl`.

### B) Dispatch test

1. With a PENDING `venue_approved` event (e.g. from step A), run `curl -X POST http://localhost:3000/api/email/dispatch` (or GET with CRON_SECRET).
2. Confirm the received email has subject "{VenueName} is approved — you're live on Nooc 🎉" (with the actual venue name) and body that references the venue name and has "Go to your dashboard" linking to the venue dashboard URL.

### C) Debug panel test

1. Open Email Debug (`/admin/email-debug`) as an admin.
2. Confirm `venue_approved` appears in the type filter; select it and confirm events of that type are listed.
3. Click a `venue_approved` row to expand; confirm the payload preview shows `venueName` (and `venueId`, `dashboardUrl`) and that the derived subject shows the venue-specific subject when `venueName` is present.
4. After running dispatch, confirm the event's status moves from PENDING to SENT.

### D) Safety / idempotency

1. **Re-approval:** Attempt to approve an already-approved venue (e.g. call POST approve again or use the approvals UI). The API returns 400 ("Venue cannot be approved. Current status: APPROVED") and no new notification is enqueued.
2. **Dedupe:** If the same `venue_approved:<venueId>` were enqueued twice (e.g. from another code path), the second `enqueueNotification` call returns `created: false` and does not create a duplicate row; only one email would ever be sent.
