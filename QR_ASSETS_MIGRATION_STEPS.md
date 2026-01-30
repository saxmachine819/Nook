# QR Assets Migration Steps (with Shadow Database Fix)

## Problem
The shadow database is out of sync, causing migration `20250122000000_add_venue_ownership` to fail because the `venues` table doesn't exist in the shadow database.

## Solution Options

### Option 1: Reset Shadow Database (Recommended)

This resets Prisma's shadow database and re-applies all migrations:

```bash
# 1. Reset the shadow database
npx prisma migrate reset --skip-seed

# 2. Generate Prisma client
npx prisma generate

# 3. Create and apply the QR assets migration
npx prisma migrate dev --name add_qr_assets_table
```

**Note**: `migrate reset` will drop and recreate your database. Only use this in development!

### Option 2: Use `prisma db push` (Quick Fix)

This bypasses the shadow database and applies schema changes directly:

```bash
# 1. Push schema changes directly to database (bypasses shadow DB)
npx prisma db push

# 2. Generate Prisma client
npx prisma generate
```

**Note**: `db push` doesn't create migration files. If you need migration history, use Option 1 or 3.

### Option 3: Disable Shadow Database Temporarily

If you need to keep migration history but fix the shadow DB issue:

```bash
# 1. Add this to your schema.prisma datasource block temporarily:
# shadowDatabaseUrl = env("SHADOW_DATABASE_URL")

# Or disable shadow database checks:
npx prisma migrate dev --name add_qr_assets_table --skip-seed --create-only

# 2. Then manually review and apply the migration
npx prisma migrate deploy

# 3. Generate Prisma client
npx prisma generate
```

### Option 4: Fix Shadow Database Manually (Advanced)

If you have access to your shadow database:

```bash
# 1. Check your shadow database URL (if set in .env)
# Look for SHADOW_DATABASE_URL or check Prisma docs

# 2. Apply all existing migrations to shadow database
npx prisma migrate deploy --schema=./prisma/schema.prisma

# 3. Then create new migration
npx prisma migrate dev --name add_qr_assets_table
```

## Recommended Steps for Your Situation

Since you're in development, I recommend **Option 1** (reset shadow database):

```bash
# Step 1: Reset shadow database and re-apply all migrations
npx prisma migrate reset --skip-seed

# Step 2: This will prompt you - type 'y' to confirm
# It will drop your database and recreate it with all migrations

# Step 3: Generate Prisma client
npx prisma generate

# Step 4: Verify the migration worked
npx prisma studio
# Check that qr_assets table exists
```

## Verification After Migration

1. **Check migration status**:
   ```bash
   npx prisma migrate status
   ```

2. **Verify table exists**:
   ```bash
   npx prisma studio
   ```
   Look for `qr_assets` table with all columns.

3. **Test Prisma client**:
   ```bash
   npm run db:generate
   ```
   Should complete without errors.

4. **Verify in code**:
   ```typescript
   import { prisma } from '@/lib/prisma'
   // Should have prisma.qRAsset available
   ```

## If Option 1 Doesn't Work

If `migrate reset` fails, try **Option 2** (`db push`):

```bash
npx prisma db push
npx prisma generate
```

This will sync your schema directly without using migrations. You can create migrations later if needed.

## Important Notes

- **Backup your data** if using `migrate reset` - it will delete all data!
- The shadow database is used by Prisma to detect schema drift
- If you're using Supabase, make sure your `DATABASE_URL` is correct
- For production, always use `prisma migrate deploy` instead of `migrate dev`
