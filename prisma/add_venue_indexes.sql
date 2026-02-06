-- Performance indexes for venue search and filtering
-- Run this manually in your database or use: node scripts/apply-indexes.js

-- Location-based queries (most common)
CREATE INDEX IF NOT EXISTS idx_venues_location
ON venues(latitude, longitude)
WHERE "onboardingStatus" = 'APPROVED' AND status != 'DELETED' AND "pausedAt" IS NULL;

-- Price filtering
CREATE INDEX IF NOT EXISTS idx_venues_price
ON venues("hourlySeatPrice")
WHERE "onboardingStatus" = 'APPROVED' AND status != 'DELETED' AND "pausedAt" IS NULL;

-- Tags filtering (GIN index for array contains operations)
CREATE INDEX IF NOT EXISTS idx_venues_tags
ON venues USING GIN(tags)
WHERE "onboardingStatus" = 'APPROVED' AND status != 'DELETED' AND "pausedAt" IS NULL;

-- Text search on name/address/city
CREATE INDEX IF NOT EXISTS idx_venues_name_search
ON venues(name text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_venues_city_search
ON venues(city text_pattern_ops);

-- Composite index for common query pattern (location + price)
CREATE INDEX IF NOT EXISTS idx_venues_location_price
ON venues(latitude, longitude, "hourlySeatPrice")
WHERE "onboardingStatus" = 'APPROVED' AND status != 'DELETED' AND "pausedAt" IS NULL;

-- Index for favorites filtering
CREATE INDEX IF NOT EXISTS idx_favorite_venues_user
ON favorite_venues("userId", "venueId");

-- Index for deals filtering
CREATE INDEX IF NOT EXISTS idx_venue_deals_active
ON deals("venueId", "isActive");

-- Index for active tables (used in capacity calculations)
CREATE INDEX IF NOT EXISTS idx_tables_venue_active
ON tables("venueId", "isActive");

-- Index for active seats
CREATE INDEX IF NOT EXISTS idx_seats_table_active
ON seats("tableId", "isActive");

-- Index for reservations by venue and time range
CREATE INDEX IF NOT EXISTS idx_reservations_venue_time
ON reservations("venueId", "startAt", "endAt")
WHERE status != 'cancelled';
