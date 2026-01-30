# How to Verify QR Assets Table

## Issue: Prisma Studio shows "no rows available" without columns

This is normal for an empty table in Prisma Studio. The columns should still be visible. Here's how to verify:

## Method 1: Check Prisma Studio Table Structure

1. Open Prisma Studio:
   ```bash
   npx prisma studio
   ```

2. Look for `qr_assets` in the left sidebar (should be near the bottom)

3. Click on `qr_assets` table

4. Even if it says "No rows available", you should see:
   - Column headers at the top (id, token, status, etc.)
   - An "Add record" button
   - Column names visible in the header row

5. If you see column headers, the table exists correctly!

## Method 2: Run Verification Script

```bash
npx tsx scripts/verify-qr-assets.ts
```

If `tsx` is not installed:
```bash
npm install -D tsx
npx tsx scripts/verify-qr-assets.ts
```

## Method 3: Quick TypeScript Check

Open any TypeScript file and try typing:

```typescript
import { prisma } from '@/lib/prisma'

// Type this and check for autocomplete:
prisma.qRAsset.
```

If you see autocomplete suggestions (like `findMany`, `findUnique`, `create`), it's working!

## Method 4: Check in Your Code Editor

Open `lib/qr-asset-utils.ts`:
- Line 50 has `prisma.qRAsset.findUnique()`
- If there are NO red squiggly lines, TypeScript recognizes it
- Hover over `qRAsset` - you should see type information

## Method 5: Direct Database Query (if you have DB access)

If you have direct database access, you can verify the table structure:

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'qr_assets' 
ORDER BY ordinal_position;
```

Expected columns:
- id (uuid)
- token (text, unique)
- status (enum: UNREGISTERED, ACTIVE, RETIRED)
- venueId (text, nullable)
- resourceType (text, nullable)
- resourceId (text, nullable)
- activatedAt (timestamp, nullable)
- retiredAt (timestamp, nullable)
- createdAt (timestamp)
- updatedAt (timestamp)

## Troubleshooting

### If Prisma Studio doesn't show the table at all:

1. Make sure you ran `npx prisma generate` after `db push`
2. Refresh Prisma Studio (close and reopen)
3. Check that `db push` completed successfully

### If TypeScript doesn't recognize `qRAsset`:

1. Run `npx prisma generate`
2. Restart your TypeScript server in VS Code (Cmd+Shift+P → "TypeScript: Restart TS Server")
3. Check that `prisma/schema.prisma` has the QRAsset model

### If verification script fails:

Make sure you have `tsx` installed:
```bash
npm install -D tsx
```

Or use Node.js directly with a compiled version (more complex).

## Quick Test: Create a Test Record

If everything else works, try creating a test record in Prisma Studio:

1. Click "Add record" in `qr_assets` table
2. Fill in:
   - `token`: `test-token-1234567890123456` (16+ chars, URL-safe)
   - `status`: `UNREGISTERED` (from dropdown)
   - Leave other fields empty/null
3. Click "Save 1 change"
4. If it saves successfully, the table is working!
