-- Add Owner Info columns to venues table
-- Run this in your SQL editor (e.g. Supabase SQL Editor) if you're not using Prisma migrate.

-- Add columns (nullable at first so ADD COLUMN IF NOT EXISTS is safe)
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS "ownerFirstName" TEXT,
  ADD COLUMN IF NOT EXISTS "ownerLastName"  TEXT,
  ADD COLUMN IF NOT EXISTS "ownerPhone"     TEXT;

-- Make owner phone mandatory: backfill NULLs then set NOT NULL
UPDATE venues SET "ownerPhone" = '' WHERE "ownerPhone" IS NULL;
ALTER TABLE venues ALTER COLUMN "ownerPhone" SET NOT NULL;

-- Optional: add a comment for documentation
COMMENT ON COLUMN venues."ownerFirstName" IS 'Venue owner first name (contact display)';
COMMENT ON COLUMN venues."ownerLastName"  IS 'Venue owner last name (contact display)';
COMMENT ON COLUMN venues."ownerPhone"     IS 'Venue owner phone number (contact display, required)';
