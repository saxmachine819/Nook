# Migration Instructions for Approval Tracking Fields

## Issue
The migration is failing because the shadow database doesn't have the base schema. This is a common issue when:
- The database was set up using `prisma db push` instead of migrations
- The migrations folder is missing or incomplete
- The shadow database needs to be reset

## Solution Options

### Option 1: Use `prisma db push` (Recommended for Development)

If you're in development and don't need migration history, use:

```bash
npx prisma db push
npx prisma generate
```

This will apply the schema changes directly without creating migration files.

### Option 2: Create Migration Manually

If you need proper migrations, you can create the migration manually:

1. **First, ensure your database is up to date:**
   ```bash
   npx prisma db push
   npx prisma generate
   ```

2. **Then create a migration for the new fields:**
   ```bash
   npx prisma migrate dev --name add_approval_tracking_fields --create-only
   ```

3. **If that fails, you can create the migration SQL manually:**

Create a file: `prisma/migrations/[timestamp]_add_approval_tracking_fields/migration.sql`

```sql
-- AlterTable
ALTER TABLE "venues" ADD COLUMN "approvedByUserId" TEXT,
ADD COLUMN "rejectedByUserId" TEXT;

-- AddForeignKey
ALTER TABLE "venues" ADD CONSTRAINT "venues_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venues" ADD CONSTRAINT "venues_rejectedByUserId_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

4. **Then apply it:**
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

### Option 3: Reset Shadow Database

If you want to use migrations properly, you may need to reset the shadow database:

1. **Check your Prisma schema for shadow database URL:**
   - If you have a separate shadow database, ensure it's accessible
   - Or use the same database for shadow (not recommended for production)

2. **Try creating the migration with shadow database disabled:**
   ```bash
   PRISMA_MIGRATE_SKIP_GENERATE=1 npx prisma migrate dev --name add_approval_tracking_fields --skip-seed
   ```

## What Changed

The schema now includes:
- `approvedByUserId String?` - Tracks which admin approved the venue
- `rejectedByUserId String?` - Tracks which admin rejected the venue
- Relations to User model for `approvedBy` and `rejectedBy`

## After Migration

Once the migration is applied:
1. Run `npx prisma generate` to update the Prisma client
2. Restart your development server
3. Test the admin approvals page at `/admin/approvals`
