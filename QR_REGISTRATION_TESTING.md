# QR Asset Registration Flow - Testing Guide

## Implementation Summary

The QR asset registration flow has been implemented with a protected page and API endpoint to assign unregistered QR assets to venues and resources.

## Files Changed

1. **`app/q/[token]/register/page.tsx`** - Protected registration page (server component)
2. **`components/qr/QRRegistrationForm.tsx`** - Registration form component (client component)
3. **`app/api/qr-assets/assign/route.ts`** - Assignment API endpoint
4. **`app/api/venues/[id]/resources/route.ts`** - Venue resources API endpoint (seats/tables)
5. **`lib/qr-asset-utils.ts`** - Added `getVenueResources()` helper function
6. **`components/qr/UnregisteredQRPage.tsx`** - Updated link to use `/q/[token]/register`

## Features Implemented

- Protected page requiring authentication
- Permission check (user must own venues or be admin)
- Auto-selection of venue if user manages exactly one
- Dropdown selection for multiple venues
- Resource type selection (seat/table/area)
- Dynamic resource fetching based on selected venue
- Area identifier text input for area resources
- Comprehensive validation and error handling
- Success redirect to QR scan page

## Testing Steps

### Prerequisites

1. **Create unregistered QR asset:**
   ```bash
   # Via batch-create API or Prisma Studio
   # Token: test-register-1, Status: UNREGISTERED
   ```

2. **Ensure you have venues:**
   - Log in as a user who owns at least one venue
   - Or log in as admin

### Test 1: Access Registration Page (Not Logged In)

```
Visit: http://localhost:3000/q/test-register-1/register
```

**Expected Result:**
- Redirects to `/profile?callbackUrl=/q/test-register-1/register`
- After login, redirects back to registration page

### Test 2: Access Registration Page (No Permissions)

1. Log in as a regular user who doesn't own any venues
2. Visit: `http://localhost:3000/q/test-register-1/register`

**Expected Result:**
- Shows "Permission Denied" page
- Message: "You must own at least one venue or be an admin to register QR codes."

### Test 3: Access Registration Page (Has Permissions)

1. Log in as venue owner or admin
2. Visit: `http://localhost:3000/q/test-register-1/register`

**Expected Result:**
- Shows registration form
- If user owns exactly one venue: Venue is auto-selected and shown as read-only
- If user owns multiple venues: Venue dropdown is shown

### Test 4: Register QR to Seat

1. Log in as venue owner
2. Visit registration page
3. Select venue (or use auto-selected)
4. Select "Seat" from resource type dropdown
5. Wait for seats to load
6. Select a seat from dropdown
7. Click "Assign QR"

**Expected Result:**
- Success toast: "QR code assigned successfully"
- Redirects to `/q/test-register-1`
- QR scan page shows ACTIVE status and redirects to venue
- Database shows: `status=ACTIVE`, `venueId`, `resourceType=seat`, `resourceId` set

### Test 5: Register QR to Table

1. Follow steps 1-3 from Test 4
2. Select "Table" from resource type dropdown
3. Select a table from dropdown
4. Click "Assign QR"

**Expected Result:**
- Same as Test 4, but `resourceType=table`

### Test 6: Register QR to Area

1. Follow steps 1-3 from Test 4
2. Select "Area" from resource type dropdown
3. Enter area identifier (e.g., "Main Floor", "Patio")
4. Click "Assign QR"

**Expected Result:**
- Same as Test 4, but `resourceType=area`, `resourceId` = entered text

### Test 7: API Validation - Missing Fields

```bash
curl -X POST http://localhost:3000/api/qr-assets/assign \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -d '{"token": "test-register-1"}'
```

**Expected Result:**
- 400 error: "Missing required fields: token, venueId, and resourceType are required"

### Test 8: API Validation - Wrong Status

1. Create QR asset with status ACTIVE
2. Try to assign it via API

**Expected Result:**
- 409 error: "QR asset is already assigned (status: ACTIVE)"

### Test 9: API Validation - No Permission

1. Log in as user who doesn't own the venue
2. Try to assign QR to someone else's venue

**Expected Result:**
- 403 error: "You do not have permission to manage this venue"

### Test 10: API Validation - Invalid Resource

1. Try to assign QR with invalid seat/table ID

**Expected Result:**
- 404 error: "Seat not found" or "Table not found"

## Verification Checklist

After successful registration:

- [ ] QR asset status changed to ACTIVE in database
- [ ] `venueId` is set correctly
- [ ] `resourceType` matches selection (seat/table/area)
- [ ] `resourceId` matches selection
- [ ] `activatedAt` timestamp is set
- [ ] Redirect to QR scan page works
- [ ] QR scan page shows ACTIVE status
- [ ] QR scan redirects to venue page with resource preselection

## API Endpoint Testing

### Success Case:

```bash
curl -X POST http://localhost:3000/api/qr-assets/assign \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -d '{
    "token": "test-register-1",
    "venueId": "venue-id-here",
    "resourceType": "seat",
    "resourceId": "seat-id-here"
  }'
```

Expected response:
```json
{
  "success": true,
  "qrAsset": {
    "id": "...",
    "token": "test-register-1",
    "status": "ACTIVE",
    "venueId": "...",
    "resourceType": "seat",
    "resourceId": "...",
    "activatedAt": "2025-01-27T...",
    "venue": {...}
  }
}
```

## Troubleshooting

### "Permission Denied" when user owns venues
- Check `canRegisterQR()` function is working correctly
- Verify user's venues exist in database
- Check `ownerId` matches `user.id`

### Resources not loading
- Check `/api/venues/[id]/resources` endpoint is accessible
- Verify venue has tables/seats
- Check browser console for errors

### Assignment fails
- Verify QR asset status is UNREGISTERED
- Check user has permission to manage venue
- Verify resource exists and belongs to venue
- Check server logs for detailed errors

### Form doesn't submit
- Verify all fields are filled
- Check resourceType is valid (seat/table/area)
- Verify resourceId is set (or area text entered)
