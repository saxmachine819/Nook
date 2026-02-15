-- Run this only if you already ran add_venue_owner_info.sql (the original version).
-- Makes owner phone mandatory: backfill NULLs then set NOT NULL.

UPDATE venues SET "ownerPhone" = '' WHERE "ownerPhone" IS NULL;
ALTER TABLE venues ALTER COLUMN "ownerPhone" SET NOT NULL;
