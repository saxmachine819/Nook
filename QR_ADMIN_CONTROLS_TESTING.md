# QR Asset Admin Management Controls - Testing Guide

## Implementation Summary

Added minimal admin controls for venue admins to manage active QR assets. When a venue admin scans an active QR code, they see an admin panel with reassign and retire options before the normal redirect.

## Files Changed

1. **`components/qr/QRAdminPanel.tsx`** - Admin panel component with reassign/retire buttons
2. **`components/qr/QRRedirectWithAdminPanel.tsx`** - Wrapper component with redirect delay
3. **`app/api/qr-assets/reassign/route.ts`** - Reassign endpoint (allows ACTIVE status)
4. **`app/api/qr-assets/retire/route.ts`** - Retire endpoint
5. **`app/q/[token]/page.tsx`** - Modified to show admin panel for venue admins
6. **`app/q/[token]/register/page.tsx`** - Updated to accept query params and allow ACTIVE QR reassignment
7. **`components/qr/QRRegistrationForm.tsx`** - Updated to accept initial values for prefilling
8. **`app/api/qr-assets/assign/route.ts`** - Updated to allow ACTIVE status for reassignment

## Features Implemented

- Admin panel appears for venue admins scanning active QR codes
- 3-second redirect delay to allow admin actions
- "Reassign" button links to registration page with prefilled data
- "Retire" button retires QR code and redirects to scan page
- "Continue to booking" button for immediate redirect
- Registration page accepts query params for prefilling
- Form prefills venue, resource type, and resource ID from query params

## Testing Steps

### Prerequisites

1. **Create active QR asset** assigned to a venue:
   - Token: `test-admin-1`
   - Status: `ACTIVE`
   - venueId: (your venue ID)
   - resourceType: `seat` (or `table`/`area`)
   - resourceId: (seat/table ID or area identifier)

2. **Ensure you have a venue** that you own (or be admin)

### Test 1: Admin Panel Visibility (Venue Owner)

1. Log in as venue owner (owns the QR's venue)
2. Visit: `http://localhost:3000/q/test-admin-1`

**Expected Result:**
- Admin panel appears at top
- Shows "Admin Controls" label
- Two buttons: "Reassign" and "Retire"
- Countdown message: "Redirecting to booking in 3 seconds..."
- "Continue to booking now" button
- After 3 seconds, redirects to venue page

### Test 2: Admin Panel Visibility (Non-Venue Owner)

1. Log in as user who doesn't own the QR's venue
2. Visit: `http://localhost:3000/q/test-admin-1`

**Expected Result:**
- Admin panel does NOT appear
- Immediate redirect to venue page (normal behavior)

### Test 3: Admin Panel Visibility (Not Logged In)

1. Log out (or use incognito)
2. Visit: `http://localhost:3000/q/test-admin-1`

**Expected Result:**
- Admin panel does NOT appear
- Immediate redirect to venue page (normal behavior)

### Test 4: Reassign QR Code

1. Log in as venue owner
2. Visit active QR: `http://localhost:3000/q/test-admin-1`
3. Click "Reassign" button in admin panel

**Expected Result:**
- Navigates to `/q/test-admin-1/register?venueId=...&resourceType=seat&resourceId=...`
- Registration form is prefilled with:
  - Venue: Selected (matches QR's venue)
  - Resource Type: Selected (matches QR's resourceType)
  - Resource: Selected (matches QR's resourceId)
4. Change selections and click "Assign QR"

**Expected Result:**
- Success toast: "QR code assigned successfully"
- Redirects to `/q/test-admin-1`
- QR scan page shows ACTIVE status
- Database shows updated venueId/resourceType/resourceId

### Test 5: Retire QR Code

1. Log in as venue owner
2. Visit active QR: `http://localhost:3000/q/test-admin-1`
3. Click "Retire" button in admin panel
4. Confirm retirement in dialog

**Expected Result:**
- Success toast: "QR code retired successfully"
- Redirects to `/q/test-admin-1` after 1 second
- QR scan page shows RetiredQRPage
- Database shows: `status=RETIRED`, `retiredAt` set
- Assignment fields preserved (venueId, resourceType, resourceId)

### Test 6: Continue to Booking Button

1. Log in as venue owner
2. Visit active QR: `http://localhost:3000/q/test-admin-1`
3. Click "Continue to booking now" button

**Expected Result:**
- Immediately redirects to venue page
- No delay

### Test 7: API - Reassign Endpoint

```bash
curl -X POST http://localhost:3000/api/qr-assets/reassign \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -d '{
    "token": "test-admin-1",
    "venueId": "new-venue-id",
    "resourceType": "table",
    "resourceId": "table-id"
  }'
```

**Expected Result:**
- 200 success response
- QR asset updated with new venue/resource
- Status remains ACTIVE
- activatedAt updated

### Test 8: API - Retire Endpoint

```bash
curl -X POST http://localhost:3000/api/qr-assets/retire \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -d '{"token": "test-admin-1"}'
```

**Expected Result:**
- 200 success response
- QR asset status changed to RETIRED
- retiredAt timestamp set
- Assignment fields preserved

### Test 9: API - Retire Without Venue Assignment

1. Create QR asset with status ACTIVE but no venueId
2. Try to retire it

**Expected Result:**
- 400 error: "QR asset must be assigned to a venue before it can be retired"

### Test 10: API - Reassign Permission Check

1. Log in as user who doesn't own the venue
2. Try to reassign QR to their own venue

**Expected Result:**
- 403 error: "You do not have permission to manage this venue"

## Verification Checklist

After testing:

- [ ] Admin panel appears for venue owners
- [ ] Admin panel does NOT appear for non-owners
- [ ] Admin panel does NOT appear for non-logged-in users
- [ ] Reassign button navigates to registration page
- [ ] Registration page prefills with QR's current assignment
- [ ] Reassign updates QR asset successfully
- [ ] Retire button shows confirmation dialog
- [ ] Retire sets status to RETIRED
- [ ] Retired QR shows RetiredQRPage
- [ ] Redirect delay works (3 seconds)
- [ ] "Continue to booking" button works immediately
- [ ] API endpoints require authentication
- [ ] API endpoints check venue permissions
- [ ] Assignment fields preserved after retirement

## Notes

- Admin panel only shows for ACTIVE QR codes with venueId
- Redirect delay is 3 seconds (configurable)
- Retire keeps assignment fields for audit trail
- Reassign endpoint allows ACTIVE status (unlike initial assign)
- Registration form handles both UNREGISTERED and ACTIVE QR codes
- Prefilling works via URL query params
