-- One-time: add hours columns to venues (matches prisma/schema.prisma).
-- Run this in Supabase SQL Editor (or any client) so the DB matches the schema without using prisma db push.
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE venues ADD COLUMN IF NOT EXISTS timezone TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS "hoursSource" TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS "hoursUpdatedAt" TIMESTAMP(3);
