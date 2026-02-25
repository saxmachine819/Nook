# Production Database Sync Guide

This guide helps you sync your production database to match staging.

## Files

- **`sync-production-to-staging.sql`** - Main sync script (applies all migrations)
- **`verify-production-sync.sql`** - Verification script (checks what's missing)

## Steps

### 1. Verify Current State (Before)

Run `verify-production-sync.sql` in your **production database** (e.g. Supabase SQL Editor) to see what's currently missing:

```sql
-- Copy and paste the contents of scripts/verify-production-sync.sql
-- into your production database SQL editor and run it
```

This will show you:
- Missing columns
- Missing enums
- Missing tables
- Missing indexes
- Summary of what exists

### 2. Run the Sync Script

Run `sync-production-to-staging.sql` in your **production database**:

```sql
-- Copy and paste the contents of scripts/sync-production-to-staging.sql
-- into your production database SQL editor and run it
```

**Important Notes:**
- ✅ **Safe to run multiple times** - The script is idempotent (uses `IF NOT EXISTS` checks)
- ✅ **No data loss** - Only adds missing tables/columns, doesn't modify existing data
- ⚠️ **Backup recommended** - Always backup production before running migrations
- ⚠️ **Test first** - Consider testing on a staging copy of production if possible

### 3. Verify Sync Complete (After)

Run `verify-production-sync.sql` again to confirm everything was applied:

```sql
-- Run verify-production-sync.sql again
-- All checks should now show empty results (nothing missing)
```

## What Gets Synced

The sync script applies these migrations:

1. ✅ `welcomeEmailSentAt` column on `users` table
2. ✅ `placePhotoUrls` column on `venues` table
3. ✅ Approval tracking fields (`approvedByUserId`, `rejectedByUserId`) on `venues`
4. ✅ Venue owner info (`ownerFirstName`, `ownerLastName`, `ownerPhone`) on `venues`
5. ✅ `venue_members` table (for venue staff/admin management)
6. ✅ `payments` and `refund_requests` tables (payment processing)
7. ✅ Signage ordering tables (`signage_templates`, `signage_orders`, `signage_order_items`)
8. ✅ `designOption` column on `signage_order_items` (allows multiple items per QR)

## Troubleshooting

### If you get "relation already exists" errors

The script uses `IF NOT EXISTS` checks, so this shouldn't happen. If it does, the object already exists and you can safely ignore the error.

### If foreign key constraints fail

Make sure the referenced tables (`users`, `venues`, `reservations`, `qr_assets`, etc.) exist first. The script creates tables in the correct order, but if you're missing base tables, fix those first.

### If you need to rollback

This script only **adds** things - it doesn't remove or modify existing data. To rollback, you'd need to manually drop the added tables/columns (not recommended unless absolutely necessary).

## Next Steps

After syncing:

1. ✅ Verify all tables exist using the verification script
2. ✅ Test your application on production
3. ✅ Check that new features work correctly
4. ✅ Monitor for any errors in production logs

## Support

If you encounter issues:
1. Check the error message carefully
2. Run the verification script to see what's still missing
3. Check that all base tables (`users`, `venues`, `reservations`, `qr_assets`, `tables`, `seats`) exist
4. Ensure you have proper database permissions
