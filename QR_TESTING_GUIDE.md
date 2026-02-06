# Complete QR Code Testing Guide

## 🎯 Quick Start: Create Test QR Code

### Method 1: Using Browser (Easiest)

1. **Start your dev server:**
   ```bash
   npm run dev
   ```

2. **Sign in as admin** at `http://localhost:3000/profile` (email: `Saxmachine819@gmail.com`)

3. **Open browser console** (F12) and run:
   ```javascript
   fetch('/api/admin/qr-assets/batch-create', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ count: 1 })
   })
   .then(r => r.json())
   .then(data => {
     console.log('✅ QR Code Created!');
     console.log('Token:', data.sampleTokens[0]);
     console.log('Test URL:', `http://localhost:3000/q/${data.sampleTokens[0]}`);
   });
   ```

4. **Copy the token** from console output

### Method 2: Using curl (Terminal)

1. **Get your session cookie:**
   - Sign in at `http://localhost:3000/profile`
   - Open DevTools → Application → Cookies
   - Copy `next-auth.session-token` value

2. **Create QR code:**
   ```bash
   curl -X POST http://localhost:3000/api/admin/qr-assets/batch-create \
     -H "Content-Type: application/json" \
     -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN_HERE" \
     -d '{"count": 1}'
   ```

3. **Copy the token** from `sampleTokens[0]` in the response

### Method 3: Direct Database (If you have DB access)

```sql
INSERT INTO qr_assets (id, token, status, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'TEST-QR-2025', 'UNREGISTERED', NOW(), NOW());
```

**Then use token:** `TEST-QR-2025`

---

## 🧪 Complete Testing Checklist

### Phase 1: Unregistered QR Code (Initial State)

#### Test 1.1: Public Scan - Not Logged In
- **URL:** `http://localhost:3000/q/TEST-QR-2025`
- **Expected:**
  - ✅ Shows "This Nooc QR hasn't been set up yet" page
  - ✅ "Log in to register" button visible
  - ✅ "Register this QR code" button NOT visible

#### Test 1.2: Public Scan - Logged In (No Venue)
- **URL:** `http://localhost:3000/q/TEST-QR-2025`
- **Setup:** Log in as user who doesn't own any venues
- **Expected:**
  - ✅ Shows "This Nooc QR hasn't been set up yet" page
  - ✅ "Log in to register" button visible
  - ✅ "Register this QR code" button NOT visible

#### Test 1.3: Public Scan - Logged In (Has Venue)
- **URL:** `http://localhost:3000/q/TEST-QR-2025`
- **Setup:** Log in as user who owns at least one venue
- **Expected:**
  - ✅ Shows "This Nooc QR hasn't been set up yet" page
  - ✅ "Register this QR code" button visible
  - ✅ Clicking button navigates to `/q/TEST-QR-2025/register`

#### Test 1.4: Registration Page - Access Denied (Not Logged In)
- **URL:** `http://localhost:3000/q/TEST-QR-2025/register`
- **Expected:**
  - ✅ Redirects to `/profile` with callback URL

#### Test 1.5: Registration Page - Access Denied (No Venue)
- **URL:** `http://localhost:3000/q/TEST-QR-2025/register`
- **Setup:** Log in as user without venues
- **Expected:**
  - ✅ Shows "Permission Denied" page
  - ✅ Message: "You must own at least one venue or be an admin"

#### Test 1.6: Registration Page - Success
- **URL:** `http://localhost:3000/q/TEST-QR-2025/register`
- **Setup:** Log in as venue owner
- **Expected:**
  - ✅ Shows registration form
  - ✅ Venue dropdown (or auto-selected if only one)
  - ✅ Resource type dropdown (seat/table/area)
  - ✅ Resource dropdown/input (populated based on type)

#### Test 1.7: Registration Form - Submit Success
- **URL:** `http://localhost:3000/q/TEST-QR-2025/register`
- **Setup:** Log in as venue owner, fill form
- **Actions:**
  1. Select venue
  2. Select resource type (e.g., "seat")
  3. Select resource (e.g., a seat)
  4. Click "Assign QR"
- **Expected:**
  - ✅ Success toast: "QR code assigned successfully"
  - ✅ Redirects to `/q/TEST-QR-2025`
  - ✅ QR status changed to ACTIVE in database
  - ✅ venueId, resourceType, resourceId set
  - ✅ activatedAt timestamp set

#### Test 1.8: Registration API - Validation Errors
- **Endpoint:** `POST /api/qr-assets/assign`
- **Test Cases:**
  ```bash
  # Missing token
  {"venueId": "venue-id", "resourceType": "seat", "resourceId": "seat-id"}
  # Expected: 400 "Missing required fields"
  
  # Invalid resourceType
  {"token": "TEST-QR-2025", "venueId": "venue-id", "resourceType": "invalid"}
  # Expected: 400 "resourceType must be 'seat', 'table', or 'area'"
  
  # Missing resourceId for seat
  {"token": "TEST-QR-2025", "venueId": "venue-id", "resourceType": "seat"}
  # Expected: 400 "resourceId is required"
  ```

---

### Phase 2: Active QR Code (After Registration)

#### Test 2.1: Public Scan - Not Logged In
- **URL:** `http://localhost:3000/q/TEST-QR-2025`
- **Setup:** QR is ACTIVE with venueId
- **Expected:**
  - ✅ Immediate redirect to `/venue/[venueId]?resourceType=seat&resourceId=seat-id`
  - ✅ No admin panel visible

#### Test 2.2: Public Scan - Logged In (Non-Venue Owner)
- **URL:** `http://localhost:3000/q/TEST-QR-2025`
- **Setup:** Log in as user who doesn't own the QR's venue
- **Expected:**
  - ✅ Immediate redirect to venue page
  - ✅ No admin panel visible

#### Test 2.3: Public Scan - Logged In (Venue Owner) ⭐ KEY TEST
- **URL:** `http://localhost:3000/q/TEST-QR-2025`
- **Setup:** Log in as user who owns the QR's venue
- **Expected:**
  - ✅ Admin panel appears at top
  - ✅ Shows "Admin Controls" label
  - ✅ Two buttons: "Reassign" and "Retire"
  - ✅ Countdown: "Redirecting to booking in 3 seconds..."
  - ✅ "Continue to booking now" button
  - ✅ After 3 seconds, redirects to venue page

#### Test 2.4: Admin Panel - Reassign Button
- **URL:** `http://localhost:3000/q/TEST-QR-2025`
- **Setup:** Logged in as venue owner, admin panel visible
- **Action:** Click "Reassign" button
- **Expected:**
  - ✅ Navigates to `/q/TEST-QR-2025/register?venueId=...&resourceType=seat&resourceId=...`
  - ✅ Registration form prefilled with current assignment
  - ✅ Can change selections and reassign

#### Test 2.5: Admin Panel - Retire Button
- **URL:** `http://localhost:3000/q/TEST-QR-2025`
- **Setup:** Logged in as venue owner, admin panel visible
- **Action:** Click "Retire" button, confirm
- **Expected:**
  - ✅ Confirmation dialog appears
  - ✅ After confirm: Success toast "QR code retired successfully"
  - ✅ Redirects to `/q/TEST-QR-2025` after 1 second
  - ✅ Shows RetiredQRPage
  - ✅ Database: status=RETIRED, retiredAt set, assignment fields preserved

#### Test 2.6: Admin Panel - Continue Button
- **URL:** `http://localhost:3000/q/TEST-QR-2025`
- **Setup:** Logged in as venue owner, admin panel visible
- **Action:** Click "Continue to booking now"
- **Expected:**
  - ✅ Immediately redirects to venue page (no delay)

#### Test 2.7: Reassign API - Success
- **Endpoint:** `POST /api/qr-assets/reassign`
- **Body:**
  ```json
  {
    "token": "TEST-QR-2025",
    "venueId": "new-venue-id",
    "resourceType": "table",
    "resourceId": "table-id"
  }
  ```
- **Expected:**
  - ✅ 200 success response
  - ✅ QR asset updated with new venue/resource
  - ✅ Status remains ACTIVE
  - ✅ activatedAt updated

#### Test 2.8: Reassign API - Permission Check
- **Endpoint:** `POST /api/qr-assets/reassign`
- **Setup:** Log in as user who doesn't own the venue
- **Expected:**
  - ✅ 403 error: "You do not have permission to manage this venue"

---

### Phase 3: Retired QR Code

#### Test 3.1: Public Scan - Retired QR
- **URL:** `http://localhost:3000/q/TEST-QR-2025`
- **Setup:** QR status is RETIRED
- **Expected:**
  - ✅ Shows RetiredQRPage
  - ✅ Message: "This QR code is no longer active"
  - ✅ No redirect

#### Test 3.2: Retire API - Success
- **Endpoint:** `POST /api/qr-assets/retire`
- **Body:** `{"token": "TEST-QR-2025"}`
- **Expected:**
  - ✅ 200 success response
  - ✅ Status changed to RETIRED
  - ✅ retiredAt timestamp set
  - ✅ Assignment fields preserved

#### Test 3.3: Retire API - Without Venue Assignment
- **Setup:** Create QR with ACTIVE status but no venueId
- **Endpoint:** `POST /api/qr-assets/retire`
- **Expected:**
  - ✅ 400 error: "QR asset must be assigned to a venue before it can be retired"

---

### Phase 4: Batch Create (Admin Only)

#### Test 4.1: Batch Create - Default Count
- **Endpoint:** `POST /api/admin/qr-assets/batch-create`
- **Body:** `{}` or `{"count": 100}`
- **Expected:**
  - ✅ Creates 100 QR assets
  - ✅ All have status UNREGISTERED
  - ✅ Returns `{created: 100, sampleTokens: [...]}`

#### Test 4.2: Batch Create - Custom Count
- **Endpoint:** `POST /api/admin/qr-assets/batch-create`
- **Body:** `{"count": 50}`
- **Expected:**
  - ✅ Creates 50 QR assets

#### Test 4.3: Batch Create - Max Count
- **Endpoint:** `POST /api/admin/qr-assets/batch-create`
- **Body:** `{"count": 5000}`
- **Expected:**
  - ✅ Creates 5000 QR assets

#### Test 4.4: Batch Create - Over Max
- **Endpoint:** `POST /api/admin/qr-assets/batch-create`
- **Body:** `{"count": 6000}`
- **Expected:**
  - ✅ 400 error: "count must be between 1 and 5000"

#### Test 4.5: Batch Create - Unauthorized
- **Endpoint:** `POST /api/admin/qr-assets/batch-create`
- **Setup:** Not logged in or not admin
- **Expected:**
  - ✅ 401/403 error

---

### Phase 5: Invalid QR Codes

#### Test 5.1: Invalid Token Format
- **URL:** `http://localhost:3000/q/invalid-token-format!!!`
- **Expected:**
  - ✅ Shows InvalidQRCodePage
  - ✅ Message: "Invalid QR code"

#### Test 5.2: Non-Existent Token
- **URL:** `http://localhost:3000/q/DOESNOTEXIST123`
- **Expected:**
  - ✅ Shows InvalidQRCodePage

---

## 🔍 Verification Steps

After completing tests, verify in database:

```sql
-- Check QR asset status
SELECT token, status, "venueId", "resourceType", "resourceId", 
       "activatedAt", "retiredAt", "createdAt"
FROM qr_assets
WHERE token = 'TEST-QR-2025';

-- Expected after registration:
-- status: ACTIVE
-- venueId: (your venue ID)
-- resourceType: seat/table/area
-- resourceId: (resource ID)
-- activatedAt: (timestamp)

-- Expected after retirement:
-- status: RETIRED
-- retiredAt: (timestamp)
-- (assignment fields preserved)
```

---

## 📝 Quick Test Summary

**Fastest way to test everything:**

1. **Create QR:** Use batch-create API → get token
2. **Test Unregistered:** Visit `/q/[token]` → should show unregistered page
3. **Register:** Visit `/q/[token]/register` → fill form → assign
4. **Test Active:** Visit `/q/[token]` as venue owner → admin panel appears
5. **Test Reassign:** Click "Reassign" → form prefilled → change → submit
6. **Test Retire:** Visit `/q/[token]` → click "Retire" → confirm
7. **Test Retired:** Visit `/q/[token]` → should show retired page

---

## 🐛 Common Issues

- **Admin panel not showing:** Make sure you're logged in as the venue owner
- **Registration form empty:** Check that venue has seats/tables
- **API 401/403:** Make sure you're logged in and have correct permissions
- **Redirect not working:** Check that venueId exists in QR asset

---

## 📚 Related Documentation

- `QR_ADMIN_CONTROLS_TESTING.md` - Detailed admin controls testing
- `QR_REGISTRATION_TESTING.md` - Registration flow testing
- `QR_SCAN_ROUTE_TESTING.md` - Public scan route testing
- `BATCH_CREATE_QR_ASSETS_TESTING.md` - Batch create API testing
