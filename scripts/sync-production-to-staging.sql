-- ============================================================================
-- Sync Production Database to Match Staging
-- ============================================================================
-- This script applies all migrations that exist in staging but may be missing
-- in production. It's idempotent (safe to run multiple times).
-- Run this in your production database (e.g. Supabase SQL Editor).
-- ============================================================================

-- ============================================================================
-- 1. Add welcomeEmailSentAt to users table
-- ============================================================================
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "welcomeEmailSentAt" TIMESTAMP(3);

-- ============================================================================
-- 2. Add placePhotoUrls to venues table
-- ============================================================================
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "placePhotoUrls" JSONB;

-- ============================================================================
-- 3. Add approval tracking fields to venues table
-- ============================================================================
ALTER TABLE "venues" 
ADD COLUMN IF NOT EXISTS "approvedByUserId" TEXT,
ADD COLUMN IF NOT EXISTS "rejectedByUserId" TEXT;

-- Add foreign key constraints (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'venues_approvedByUserId_fkey'
    ) THEN
        ALTER TABLE "venues" 
        ADD CONSTRAINT "venues_approvedByUserId_fkey" 
        FOREIGN KEY ("approvedByUserId") 
        REFERENCES "users"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'venues_rejectedByUserId_fkey'
    ) THEN
        ALTER TABLE "venues" 
        ADD CONSTRAINT "venues_rejectedByUserId_fkey" 
        FOREIGN KEY ("rejectedByUserId") 
        REFERENCES "users"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- 4. Add venue owner info columns
-- ============================================================================
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS "ownerFirstName" TEXT,
  ADD COLUMN IF NOT EXISTS "ownerLastName"  TEXT,
  ADD COLUMN IF NOT EXISTS "ownerPhone"     TEXT;

-- Make owner phone mandatory: backfill NULLs then set NOT NULL (if not already)
DO $$
BEGIN
    -- Check if column is already NOT NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'venues' 
        AND column_name = 'ownerPhone' 
        AND is_nullable = 'YES'
    ) THEN
        UPDATE venues SET "ownerPhone" = '' WHERE "ownerPhone" IS NULL;
        ALTER TABLE venues ALTER COLUMN "ownerPhone" SET NOT NULL;
    END IF;
END $$;

-- ============================================================================
-- 5. Create VenueMemberRole enum and venue_members table
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VenueMemberRole') THEN
    CREATE TYPE "VenueMemberRole" AS ENUM ('staff', 'admin');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "venue_members" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "role" "VenueMemberRole" NOT NULL DEFAULT 'staff',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "venue_members_pkey" PRIMARY KEY ("id")
);

-- Create indexes (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "venue_members_venueId_email_key" ON "venue_members"("venueId", "email");
CREATE INDEX IF NOT EXISTS "venue_members_venueId_userId_idx" ON "venue_members"("venueId", "userId");
CREATE INDEX IF NOT EXISTS "venue_members_venueId_email_idx" ON "venue_members"("venueId", "email");

-- Add foreign keys (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'venue_members_venueId_fkey'
    ) THEN
        ALTER TABLE "venue_members" 
        ADD CONSTRAINT "venue_members_venueId_fkey" 
        FOREIGN KEY ("venueId") 
        REFERENCES "venues"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'venue_members_userId_fkey'
    ) THEN
        ALTER TABLE "venue_members" 
        ADD CONSTRAINT "venue_members_userId_fkey" 
        FOREIGN KEY ("userId") 
        REFERENCES "users"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- 6. Create PaymentStatus and RefundStatus enums and payments tables
-- ============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentStatus') THEN
        CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELED', 'REFUNDED');
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RefundStatus') THEN
        CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELED');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "payments" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "userId" TEXT,
    "venueId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "stripeTransferId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "refund_requests" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "reservationId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "reason" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "stripeRefundId" TEXT,
    "metadata" JSONB,
    "requestedByUserId" TEXT,
    "processedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "refund_requests_pkey" PRIMARY KEY ("id")
);

-- Create indexes for payments (idempotent)
CREATE INDEX IF NOT EXISTS "payments_reservationId_idx" ON "payments"("reservationId");
CREATE INDEX IF NOT EXISTS "payments_userId_idx" ON "payments"("userId");
CREATE INDEX IF NOT EXISTS "payments_venueId_idx" ON "payments"("venueId");
CREATE INDEX IF NOT EXISTS "payments_status_idx" ON "payments"("status");

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'payments_stripePaymentIntentId_key'
    ) THEN
        CREATE UNIQUE INDEX "payments_stripePaymentIntentId_key" ON "payments"("stripePaymentIntentId");
    END IF;
END $$;

-- Create indexes for refund_requests (idempotent)
CREATE INDEX IF NOT EXISTS "refund_requests_paymentId_idx" ON "refund_requests"("paymentId");
CREATE INDEX IF NOT EXISTS "refund_requests_reservationId_idx" ON "refund_requests"("reservationId");
CREATE INDEX IF NOT EXISTS "refund_requests_status_idx" ON "refund_requests"("status");

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'refund_requests_stripeRefundId_key'
    ) THEN
        CREATE UNIQUE INDEX "refund_requests_stripeRefundId_key" ON "refund_requests"("stripeRefundId");
    END IF;
END $$;

-- Add foreign keys for payments (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'payments_reservationId_fkey'
    ) THEN
        ALTER TABLE "payments" 
        ADD CONSTRAINT "payments_reservationId_fkey" 
        FOREIGN KEY ("reservationId") 
        REFERENCES "reservations"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'payments_userId_fkey'
    ) THEN
        ALTER TABLE "payments" 
        ADD CONSTRAINT "payments_userId_fkey" 
        FOREIGN KEY ("userId") 
        REFERENCES "users"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'payments_venueId_fkey'
    ) THEN
        ALTER TABLE "payments" 
        ADD CONSTRAINT "payments_venueId_fkey" 
        FOREIGN KEY ("venueId") 
        REFERENCES "venues"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- Add foreign keys for refund_requests (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'refund_requests_paymentId_fkey'
    ) THEN
        ALTER TABLE "refund_requests" 
        ADD CONSTRAINT "refund_requests_paymentId_fkey" 
        FOREIGN KEY ("paymentId") 
        REFERENCES "payments"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'refund_requests_requestedByUserId_fkey'
    ) THEN
        ALTER TABLE "refund_requests" 
        ADD CONSTRAINT "refund_requests_requestedByUserId_fkey" 
        FOREIGN KEY ("requestedByUserId") 
        REFERENCES "users"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'refund_requests_processedByUserId_fkey'
    ) THEN
        ALTER TABLE "refund_requests" 
        ADD CONSTRAINT "refund_requests_processedByUserId_fkey" 
        FOREIGN KEY ("processedByUserId") 
        REFERENCES "users"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- 7. Create Signage ordering tables and enums
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SignageOrderStatus') THEN
    CREATE TYPE "SignageOrderStatus" AS ENUM ('NEW', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'CANCELLED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SignageTemplateCategory') THEN
    CREATE TYPE "SignageTemplateCategory" AS ENUM ('WINDOW', 'COUNTER', 'TABLE_TENT', 'REGISTER', 'STANDARD');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SignageQrScopeType') THEN
    CREATE TYPE "SignageQrScopeType" AS ENUM ('STORE', 'TABLE', 'SEAT');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "signage_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "SignageTemplateCategory" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "previewImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "signage_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "signage_orders" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "status" "SignageOrderStatus" NOT NULL DEFAULT 'NEW',
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "shipAddress1" TEXT NOT NULL,
    "shipAddress2" TEXT,
    "shipCity" TEXT NOT NULL,
    "shipState" TEXT NOT NULL,
    "shipPostalCode" TEXT NOT NULL,
    "shipCountry" TEXT NOT NULL,
    "shippingNotes" TEXT,
    "adminNotes" TEXT,
    "trackingCarrier" TEXT,
    "trackingNumber" TEXT,
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "signage_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "signage_order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "qrScopeType" "SignageQrScopeType" NOT NULL,
    "qrAssetId" TEXT NOT NULL,
    "intendedTableId" TEXT,
    "intendedSeatId" TEXT,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "signage_order_items_pkey" PRIMARY KEY ("id")
);

-- Create indexes for signage tables (idempotent)
CREATE INDEX IF NOT EXISTS "signage_orders_venueId_idx" ON "signage_orders"("venueId");
CREATE INDEX IF NOT EXISTS "signage_order_items_orderId_idx" ON "signage_order_items"("orderId");
CREATE INDEX IF NOT EXISTS "signage_order_items_venueId_idx" ON "signage_order_items"("venueId");

-- Add foreign keys for signage_orders (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'signage_orders_venueId_fkey'
    ) THEN
        ALTER TABLE "signage_orders" 
        ADD CONSTRAINT "signage_orders_venueId_fkey" 
        FOREIGN KEY ("venueId") 
        REFERENCES "venues"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'signage_orders_createdByUserId_fkey'
    ) THEN
        ALTER TABLE "signage_orders" 
        ADD CONSTRAINT "signage_orders_createdByUserId_fkey" 
        FOREIGN KEY ("createdByUserId") 
        REFERENCES "users"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'signage_orders_templateId_fkey'
    ) THEN
        ALTER TABLE "signage_orders" 
        ADD CONSTRAINT "signage_orders_templateId_fkey" 
        FOREIGN KEY ("templateId") 
        REFERENCES "signage_templates"("id") 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- Add foreign keys for signage_order_items (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'signage_order_items_orderId_fkey'
    ) THEN
        ALTER TABLE "signage_order_items" 
        ADD CONSTRAINT "signage_order_items_orderId_fkey" 
        FOREIGN KEY ("orderId") 
        REFERENCES "signage_orders"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'signage_order_items_venueId_fkey'
    ) THEN
        ALTER TABLE "signage_order_items" 
        ADD CONSTRAINT "signage_order_items_venueId_fkey" 
        FOREIGN KEY ("venueId") 
        REFERENCES "venues"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'signage_order_items_qrAssetId_fkey'
    ) THEN
        ALTER TABLE "signage_order_items" 
        ADD CONSTRAINT "signage_order_items_qrAssetId_fkey" 
        FOREIGN KEY ("qrAssetId") 
        REFERENCES "qr_assets"("id") 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'signage_order_items_intendedTableId_fkey'
    ) THEN
        ALTER TABLE "signage_order_items" 
        ADD CONSTRAINT "signage_order_items_intendedTableId_fkey" 
        FOREIGN KEY ("intendedTableId") 
        REFERENCES "tables"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'signage_order_items_intendedSeatId_fkey'
    ) THEN
        ALTER TABLE "signage_order_items" 
        ADD CONSTRAINT "signage_order_items_intendedSeatId_fkey" 
        FOREIGN KEY ("intendedSeatId") 
        REFERENCES "seats"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- 8. Add designOption enum and column to signage_order_items
-- ============================================================================
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
END $$;

ALTER TABLE "signage_order_items"
  ADD COLUMN IF NOT EXISTS "designOption" "SignageDesignOption" NOT NULL DEFAULT 'COUNTER_SIGN';

-- Backfill existing rows by scope type (if any exist)
UPDATE "signage_order_items" SET "designOption" = 'TABLE_TENT' WHERE "qrScopeType" = 'TABLE' AND "designOption" = 'COUNTER_SIGN';
UPDATE "signage_order_items" SET "designOption" = 'STANDARD_SEAT_QR' WHERE "qrScopeType" = 'SEAT' AND "designOption" = 'COUNTER_SIGN';

-- Drop unique constraint on qrAssetId if it exists (to allow multiple items per QR)
DROP INDEX IF EXISTS "signage_order_items_qrAssetId_key";

-- Add non-unique index for qrAssetId lookups (idempotent)
CREATE INDEX IF NOT EXISTS "signage_order_items_qrAssetId_idx" ON "signage_order_items"("qrAssetId");

-- ============================================================================
-- Sync Complete!
-- ============================================================================
-- All migrations have been applied. Your production database should now match
-- staging. Verify by checking that all tables and columns exist.
-- ============================================================================
