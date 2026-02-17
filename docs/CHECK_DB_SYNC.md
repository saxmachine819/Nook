# Check Database Sync

This guide shows you how to verify that your staging and production databases are in sync, particularly for the payment tables.

## Quick Check (Single Database)

To check if the current database (from `.env`) has the payment tables:

```bash
npx tsx scripts/check-db-sync.ts
```

This will verify that:
- ✅ `payments` table exists
- ✅ `refund_requests` table exists  
- ✅ `PaymentStatus` enum exists
- ✅ `RefundStatus` enum exists

## Compare Two Databases

To compare staging and production databases, you have two options:

### Option 1: Using Environment Variables

Set both database URLs as environment variables:

```bash
DATABASE_URL="your-production-database-url" \
DATABASE_URL_STAGING="your-staging-database-url" \
npx tsx scripts/check-db-sync.ts
```

### Option 2: Using Command Line Arguments

```bash
npx tsx scripts/check-db-sync.ts "production-url" "staging-url"
```

## What Gets Compared

The script compares:

1. **Tables**: Checks if `payments` and `refund_requests` exist in both databases
2. **Enums**: Verifies `PaymentStatus` and `RefundStatus` enums exist with same values
3. **Columns**: Compares column names, types, and nullable constraints
4. **Indexes**: Ensures all indexes match between databases
5. **Foreign Keys**: Verifies foreign key constraints are identical

## Example Output

### When Databases Are In Sync:
```
✅ DATABASES ARE IN SYNC!
```

### When Databases Differ:
```
❌ DATABASES ARE NOT IN SYNC
⚠️  payments columns differ:
   Missing in Database 2: stripeTransferId
```

## Getting Database URLs

### From Supabase Dashboard:
1. Go to your Supabase project
2. Settings → Database
3. Copy the connection string (use the pooler URL for port 6543)

### From Vercel:
1. Go to your Vercel project
2. Settings → Environment Variables
3. Copy the `DATABASE_URL` value

**Note**: Make sure you're using the connection pooler URL (port 6543) for local connections, not the direct connection URL.

## Troubleshooting

### "DATABASE_URL not found"
- Make sure `.env` file exists with `DATABASE_URL` set
- Or provide URLs as command line arguments

### Connection Errors
- Verify the database URLs are correct
- Check that you have network access to the databases
- For Supabase, ensure you're using the pooler URL (port 6543)

### Tables Missing
- Run the migration script: `npx tsx scripts/apply-payments-migration.ts`
- Or apply migrations: `npx prisma migrate deploy`

## Related Scripts

- `scripts/apply-payments-migration.ts` - Apply the payments migration
- `scripts/verify-payments-tables.ts` - Quick check if tables exist
