# Batch Create QR Assets - Testing Guide

## Files Changed

1. **`app/api/admin/qr-assets/batch-create/route.ts`** - New endpoint for batch-creating QR asset tokens

## Implementation Summary

- **Endpoint**: `POST /api/admin/qr-assets/batch-create`
- **Authorization**: Admin only (uses existing `isAdmin()` from `@/lib/venue-auth`)
- **Input**: `{ count?: number }` (default: 100, max: 5000)
- **Output**: `{ created: number, sampleTokens: string[], batchId: string }`

## Features

- Admin-only access with proper authorization checks
- Input validation (type, range, integer check)
- Cryptographically secure token generation (8-12 chars, URL-safe)
- Collision detection and retry logic
- Efficient batch insertion using Prisma `createMany`
- Error handling with appropriate HTTP status codes

## Testing Instructions

### Prerequisites

1. Ensure you're signed in as an admin user (email in `ADMIN_EMAILS` env var)
2. Get your session cookie from browser DevTools after signing in

### Method 1: Using curl

#### Get Session Cookie

1. Sign in to your app in the browser
2. Open DevTools → Application/Storage → Cookies
3. Find `next-auth.session-token` cookie value
4. Copy the value

#### Test Default Count (100 tokens)

```bash
curl -X POST http://localhost:3000/api/admin/qr-assets/batch-create \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN_HERE" \
  -d '{}'
```

Expected response:
```json
{
  "created": 100,
  "sampleTokens": ["abc12345", "xyz98765", ...],
  "batchId": "2025-01-27T..."
}
```

#### Test Custom Count (50 tokens)

```bash
curl -X POST http://localhost:3000/api/admin/qr-assets/batch-create \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN_HERE" \
  -d '{"count": 50}'
```

#### Test Max Limit (5000 tokens)

```bash
curl -X POST http://localhost:3000/api/admin/qr-assets/batch-create \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN_HERE" \
  -d '{"count": 5000}'
```

#### Test Validation - Over Limit (should fail)

```bash
curl -X POST http://localhost:3000/api/admin/qr-assets/batch-create \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN_HERE" \
  -d '{"count": 10000}'
```

Expected response:
```json
{
  "error": "count cannot exceed 5000"
}
```

#### Test Validation - Invalid Type (should fail)

```bash
curl -X POST http://localhost:3000/api/admin/qr-assets/batch-create \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN_HERE" \
  -d '{"count": "invalid"}'
```

Expected response:
```json
{
  "error": "count must be a number"
}
```

#### Test Unauthorized Access (should fail)

```bash
# Without session cookie or with non-admin user
curl -X POST http://localhost:3000/api/admin/qr-assets/batch-create \
  -H "Content-Type: application/json" \
  -d '{"count": 10}'
```

Expected response:
```json
{
  "error": "You must be signed in to create QR assets."
}
```

### Method 2: Using Postman

1. **Set Method**: POST
2. **URL**: `http://localhost:3000/api/admin/qr-assets/batch-create`
3. **Headers**:
   - `Content-Type`: `application/json`
   - `Cookie`: `next-auth.session-token=YOUR_SESSION_TOKEN_HERE`
4. **Body** (raw JSON):
   ```json
   {
     "count": 100
   }
   ```
5. Click "Send"

### Method 3: Using Browser Console (if CORS allows)

```javascript
fetch('http://localhost:3000/api/admin/qr-assets/batch-create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include', // Includes cookies
  body: JSON.stringify({ count: 100 })
})
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(err => console.error(err))
```

## Verification Steps

After successful creation:

1. **Check Prisma Studio**:
   ```bash
   npx prisma studio
   ```
   - Navigate to `qr_assets` table
   - Verify new records exist
   - Check that `status` is `UNREGISTERED`
   - Verify tokens are unique (no duplicates)
   - Verify token lengths are between 8-12 characters

2. **Verify Token Format**:
   - Tokens should be URL-safe (alphanumeric + hyphens + underscores)
   - No special characters that aren't URL-safe
   - Length between 8-12 characters

3. **Check Response**:
   - `created` matches the count requested (or less if duplicates were skipped)
   - `sampleTokens` contains first 5 tokens
   - `batchId` is a valid ISO timestamp

4. **Test Collision Handling**:
   - Create a batch of tokens
   - Create another batch immediately after
   - Verify no duplicates exist in database
   - Verify all tokens are unique

## Expected Behavior

### Success Cases

- ✅ Default count (100) creates 100 tokens
- ✅ Custom count within range creates exact count
- ✅ Max count (5000) creates 5000 tokens
- ✅ All tokens are unique
- ✅ All tokens have status 'UNREGISTERED'
- ✅ Response includes sample tokens and batchId

### Error Cases

- ❌ Count > 5000 returns 400 error
- ❌ Count < 1 returns 400 error
- ❌ Non-integer count returns 400 error
- ❌ Non-number count returns 400 error
- ❌ Unauthenticated request returns 401 error
- ❌ Non-admin user returns 403 error

## Performance Notes

- Small batches (1-100): Should complete in < 1 second
- Medium batches (100-1000): Should complete in 1-5 seconds
- Large batches (1000-5000): May take 5-15 seconds depending on database

Collision detection adds overhead but ensures uniqueness. For very large batches, consider running during off-peak hours.

## Troubleshooting

### "Unauthorized: Admin access required"
- Verify your email is in `ADMIN_EMAILS` environment variable
- Check that you're signed in with the correct account
- Verify session cookie is valid

### "Failed to generate unique tokens"
- Database may have many existing tokens
- Try reducing batch size
- Check database connection

### Tokens not appearing in database
- Check Prisma Studio to verify insertion
- Check server logs for errors
- Verify database connection is working

### Duplicate tokens found
- This should not happen due to collision detection
- Check database unique constraint on `token` field
- Review server logs for errors
