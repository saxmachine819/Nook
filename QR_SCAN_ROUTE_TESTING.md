# QR Scan Route Testing Guide

## Implementation Summary

The public QR scan route handler has been implemented at `/q/[token]` with the following features:

- Token lookup without strict format validation (supports 8-12 char tokens)
- Status-based handling (UNREGISTERED, ACTIVE, RETIRED)
- Scan event logging (console.log with TODO for future table)
- Redirect logic for ACTIVE QR codes with venue/resource preselection
- Authorization checks for registration actions

## Files Created

1. **`app/q/[token]/page.tsx`** - Main scan route handler
2. **`components/qr/InvalidQRCodePage.tsx`** - Invalid QR code page
3. **`components/qr/UnregisteredQRPage.tsx`** - Setup page for unregistered QR codes
4. **`components/qr/RetiredQRPage.tsx`** - Retired QR code page
5. **`components/qr/QRPlaceholderPage.tsx`** - Placeholder for active QR without venue
6. **`lib/qr-asset-utils.ts`** - Added `lookupQRAssetByToken()` function
7. **`lib/venue-auth.ts`** - Added `canRegisterQR()` function

## How to Test with a Known Token

### Step 1: Create Test QR Assets

#### Option A: Using Admin Batch Create Endpoint

```bash
# Create tokens via API (requires admin session)
curl -X POST http://localhost:3000/api/admin/qr-assets/batch-create \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{"count": 5}'
```

This will return sample tokens in the response.

#### Option B: Using Prisma Studio

1. Run `npx prisma studio`
2. Navigate to `qr_assets` table
3. Click "Add record"
4. Create test records with different statuses:
   - Token: `test-unregistered-1`, Status: `UNREGISTERED`
   - Token: `test-active-1`, Status: `ACTIVE`, venueId: (pick an existing venue ID)
   - Token: `test-retired-1`, Status: `RETIRED`
   - Token: `test-active-seat`, Status: `ACTIVE`, venueId: (venue ID), resourceType: `seat`, resourceId: (seat ID)

### Step 2: Test Each Status Scenario

#### Test 1: Invalid Token (Not Found)

```
Visit: http://localhost:3000/q/invalid-token-xyz123
```

**Expected Result:**
- Shows "Invalid QR code" page
- Message: "This QR code is not recognized."
- No redirect

#### Test 2: UNREGISTERED Status (Not Logged In)

```
Visit: http://localhost:3000/q/test-unregistered-1
```

**Expected Result:**
- Shows "This Nooc QR hasn't been set up yet" page
- Button: "Log in to register" (links to `/profile` with callback)
- No "Register this QR code" button (user not logged in)

#### Test 3: UNREGISTERED Status (Logged In, No Permissions)

1. Log in as a regular user (not admin, doesn't own venues)
2. Visit: `http://localhost:3000/q/test-unregistered-1`

**Expected Result:**
- Shows setup page
- Button: "Log in to register" (even though logged in, shows because no permissions)
- No "Register this QR code" button

#### Test 4: UNREGISTERED Status (Logged In, Has Permissions)

1. Log in as admin OR as a user who owns at least one venue
2. Visit: `http://localhost:3000/q/test-unregistered-1`

**Expected Result:**
- Shows setup page
- Button: "Register this QR code" (links to `/admin/qr-assets/register?token=test-unregistered-1`)
- Note: Registration page doesn't exist yet (placeholder link)

#### Test 5: ACTIVE Status (With Venue, No Resource)

```
Visit: http://localhost:3000/q/test-active-1
```

**Expected Result:**
- Logs scan event to console: `[QR Scan] token=test-active-1, status=ACTIVE, venueId=..., ...`
- Redirects to: `/venue/[venueId]`
- No query params (no resource preselection)

#### Test 6: ACTIVE Status (With Venue and Resource)

```
Visit: http://localhost:3000/q/test-active-seat
```

**Expected Result:**
- Logs scan event to console
- Redirects to: `/venue/[venueId]?resourceType=seat&resourceId=[seatId]`
- Query params included for preselection
- Note: VenueBookingWidget may not yet support these params (future enhancement)

#### Test 7: ACTIVE Status (No Venue Assignment)

Create a QR asset with status ACTIVE but no venueId:
- Token: `test-active-no-venue`, Status: `ACTIVE`, venueId: null

```
Visit: http://localhost:3000/q/test-active-no-venue
```

**Expected Result:**
- Logs scan event
- Shows placeholder page with assignment info
- Displays: "This QR code is active but not yet assigned to a venue or resource."

#### Test 8: RETIRED Status

```
Visit: http://localhost:3000/q/test-retired-1
```

**Expected Result:**
- Shows "This QR code is no longer active" page
- Message: "This QR code has been retired and is no longer in use."
- No redirect

### Step 3: Verify Scan Event Logging

Check your server console/logs for scan events. Each ACTIVE QR scan should log:

```
[QR Scan] token=test-active-1, status=ACTIVE, venueId=abc123, resourceType=null, resourceId=null, timestamp=2025-01-27T...
```

### Step 4: Test Authorization

#### Test Registration Button Visibility

1. **As non-logged-in user:**
   - Visit unregistered QR code
   - Should see "Log in to register" button only

2. **As regular user (no venue ownership):**
   - Log in as regular user
   - Visit unregistered QR code
   - Should see "Log in to register" button only

3. **As admin:**
   - Log in as admin
   - Visit unregistered QR code
   - Should see "Register this QR code" button

4. **As venue owner:**
   - Log in as user who owns at least one venue
   - Visit unregistered QR code
   - Should see "Register this QR code" button

## Quick Test Checklist

- [ ] Invalid token shows error page
- [ ] Unregistered token shows setup page
- [ ] Unregistered + logged in + has permissions shows register button
- [ ] Active token with venue redirects to venue page
- [ ] Active token with venue + resource redirects with query params
- [ ] Active token without venue shows placeholder page
- [ ] Retired token shows retired page
- [ ] Scan events are logged to console
- [ ] No assignment happens on GET request (registration button only links)

## Notes

- Token format: The lookup function accepts 8-12 character tokens (relaxed validation)
- Registration page: `/admin/qr-assets/register` doesn't exist yet (placeholder link)
- Booking preselection: VenueBookingWidget may need updates to support `resourceType` and `resourceId` query params
- Scan events: Currently logged to console. Future: create `qr_events` table
- Public route: No authentication required for scanning, but registration requires auth

## Troubleshooting

### "Invalid QR code" for valid token
- Check token exists in database: `npx prisma studio` → `qr_assets` table
- Verify token matches exactly (case-sensitive, no extra spaces)

### Redirect not working
- Check server logs for errors
- Verify venueId exists and venue is accessible
- Check that redirect URL is correct

### Registration button not showing
- Verify user is logged in
- Check user is admin OR owns at least one venue
- Verify `canRegisterQR()` function is working

### Scan events not logging
- Check server console (not browser console)
- Verify QR asset status is ACTIVE
- Check for server errors in logs
