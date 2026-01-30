# Testing POST /api/qr-assets/allocate-and-assign

You need three things: a **session cookie** (from being signed in), a **venue ID**, and a **resource ID** (seat or table that belongs to that venue).

---

## Option A: Use the browser (easiest)

1. **Start the app and sign in**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000, sign in, and make sure you’re a venue owner (or admin) so you can manage at least one venue.

2. **Get your venue ID**
   - Go to your venue dashboard: e.g. http://localhost:3000/venue/dashboard
   - Click a venue. The URL will be: `http://localhost:3000/venue/dashboard/<VENUE_ID>`
   - Copy that `<VENUE_ID>` (e.g. `clxx123abc`).

3. **Get a seat or table ID**
   - On the same venue, go to **Edit** (or the page where you manage tables/seats).
   - Or open **Prisma Studio** to look at the DB:
     ```bash
     npm run db:studio
     ```
     Open http://localhost:5555. In **seats** or **tables**, pick a row that belongs to your venue (`venueId` on tables, or table → venue). Copy its `id`.

4. **Get your session cookie**
   - In the browser where you’re signed in: **DevTools** (F12) → **Application** (Chrome) or **Storage** (Firefox) → **Cookies** → `http://localhost:3000`
   - Find the cookie named `authjs.session-token` (or similar NextAuth session cookie). Copy its **Value**.

5. **Call the endpoint**
   Replace `VENUE_ID`, `SEAT_OR_TABLE_ID`, and `YOUR_SESSION_COOKIE` with the values from above.

   **First call (should allocate and assign a new QR):**
   ```bash
   curl -X POST http://localhost:3000/api/qr-assets/allocate-and-assign \
     -H "Content-Type: application/json" \
     -d '{"venueId":"VENUE_ID","resourceType":"seat","resourceId":"SEAT_OR_TABLE_ID"}' \
     --cookie "authjs.session-token=YOUR_SESSION_COOKIE"
   ```
   Expected: **200** and something like:
   ```json
   { "token": "abc123xyz", "qrAssetId": "uuid-here", "status": "ACTIVE", "alreadyExisted": false }
   ```

   **Second call (same venue + resource, should return existing):**
   Run the **exact same** curl again.
   Expected: **200** and:
   ```json
   { "token": "abc123xyz", "qrAssetId": "uuid-here", "status": "ACTIVE", "alreadyExisted": true }
   ```
   Same `token` and `qrAssetId` as the first response.

---

## Option B: Use Prisma Studio only (no UI)

1. **Get IDs from Prisma Studio**
   ```bash
   npm run db:studio
   ```
   Open http://localhost:5555. In **venues**, pick a venue and copy its `id`. In **seats** (or **tables**), pick a row whose table/venue matches that venue and copy its `id`.

2. **Get a session cookie**
   You still need to be signed in in the app once: open http://localhost:3000, sign in, then copy the session cookie from DevTools as in Option A, step 4.

3. **Run the same curl** as in Option A, step 5.

---

## If you get 401 or 403

- **401:** You’re not signed in or the cookie is wrong. Sign in again and copy the cookie value from DevTools.
- **403:** The signed-in user doesn’t manage that venue. Use a venue where you’re the owner (or sign in as an admin).

---

## Using a table instead of a seat

Use `resourceType: "table"` and a **table** id (from the **tables** table in Prisma Studio):

```bash
curl -X POST http://localhost:3000/api/qr-assets/allocate-and-assign \
  -H "Content-Type: application/json" \
  -d '{"venueId":"VENUE_ID","resourceType":"table","resourceId":"TABLE_ID"}' \
  --cookie "authjs.session-token=YOUR_SESSION_COOKIE"
```

---

## Quick checklist

| Step | What you need |
|------|-------------------------------|
| 1 | App running (`npm run dev`), signed in in the browser |
| 2 | Venue ID (from dashboard URL or Prisma Studio) |
| 3 | Seat ID or table ID that belongs to that venue (from Prisma Studio or edit page) |
| 4 | Session cookie value (DevTools → Application → Cookies) |
| 5 | Run curl with those three values; first call `alreadyExisted: false`, second call `alreadyExisted: true` |
