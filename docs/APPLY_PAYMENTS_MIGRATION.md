# Apply Payments Migration to Both Databases

The payments migration has been applied to the current database. To apply it to both staging and production:

## Option 1: Using the Migration Script (Recommended)

The script `scripts/apply-payments-migration.ts` can be run with different `DATABASE_URL` values:

### For Staging:
```bash
DATABASE_URL="your-staging-database-url" npx tsx scripts/apply-payments-migration.ts
```

### For Production:
```bash
DATABASE_URL="your-production-database-url" npx tsx scripts/apply-payments-migration.ts
```

## Option 2: Using Prisma Migrate Deploy

If you have access to both databases:

### For Staging:
```bash
DATABASE_URL="your-staging-database-url" npx prisma migrate deploy
```

### For Production:
```bash
DATABASE_URL="your-production-database-url" npx prisma migrate deploy
```

## Option 3: Via Supabase SQL Editor

1. Copy the contents of `prisma/migrations/20260211112750_add_payments_tables/migration.sql`
2. Go to Supabase Dashboard → SQL Editor
3. Select the appropriate database (staging or production)
4. Paste and run the SQL

## Verification

After applying, verify the tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('payments', 'refund_requests');
```

You should see both `payments` and `refund_requests` tables.

## Notes

- The migration uses `IF NOT EXISTS` checks, so it's safe to run multiple times
- If tables already exist with different schemas, you may need to manually reconcile differences
- After applying, run `npx prisma generate` to update the Prisma client
