# Prisma migrate with Supabase (avoid hanging)

`prisma migrate dev` and `prisma migrate deploy` can **hang** when `DATABASE_URL` uses Supabase’s **connection pooler** (port 6543). Prisma needs a **direct** connection for migrations.

## Fix: set `DIRECT_URL` for migrations

1. **Get the direct connection string**  
   Supabase Dashboard → **Settings** → **Database** → **Connection string** → **URI**.  
   Use the one that uses **port 5432** (direct), not 6543 (pooler).

2. **Add to `.env`** (same host/user/password as your pooler URL, but port **5432**):
   ```env
   DIRECT_URL="postgresql://postgres.[ref]:[YOUR-PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require"
   ```
   Replace `[ref]` and `[YOUR-PASSWORD]` with your project ref and database password. Port must be **5432**.

3. **Run migrations**
   ```bash
   npx prisma migrate deploy
   ```
   or
   ```bash
   npx prisma migrate dev
   ```

- **App runtime** keeps using `DATABASE_URL` (pooler, port 6543).
- **Migrations** use `DIRECT_URL` (direct, port 5432) and should complete instead of hanging.
