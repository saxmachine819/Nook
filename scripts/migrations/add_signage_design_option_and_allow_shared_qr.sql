-- Signage: designOption enum + allow multiple order items per QR (Counter Sign + Window Decal)
-- Run this in Supabase SQL Editor. Safe to run once; re-running may error on CREATE TYPE if enum already exists.

-- 1. Create enum for design option (skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SignageDesignOption') THEN
    CREATE TYPE "SignageDesignOption" AS ENUM (
      'COUNTER_SIGN',
      'WINDOW_DECAL',
      'TABLE_TENT',
      'STANDARD_SEAT_QR'
    );
  END IF;
END
$$;

-- 2. Add column (idempotent in PostgreSQL 9.5+)
ALTER TABLE "signage_order_items"
  ADD COLUMN IF NOT EXISTS "designOption" "SignageDesignOption" NOT NULL DEFAULT 'COUNTER_SIGN';

-- 3. Backfill existing rows by scope type
UPDATE "signage_order_items" SET "designOption" = 'TABLE_TENT' WHERE "qrScopeType" = 'TABLE';
UPDATE "signage_order_items" SET "designOption" = 'STANDARD_SEAT_QR' WHERE "qrScopeType" = 'SEAT';

-- 4. Drop unique constraint so multiple items can share one venue QR
DROP INDEX IF EXISTS "signage_order_items_qrAssetId_key";

-- 5. Add non-unique index for qrAssetId lookups
CREATE INDEX IF NOT EXISTS "signage_order_items_qrAssetId_idx" ON "signage_order_items"("qrAssetId");
