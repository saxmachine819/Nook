-- Prevent double-booking race conditions at database level
-- This exclusion constraint ensures no overlapping reservations for the same seat/table

-- Enable btree_gist extension (required for exclusion constraints on time ranges)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Add exclusion constraint for seat reservations
-- Prevents overlapping reservations for the same seat
ALTER TABLE reservations
ADD CONSTRAINT no_overlapping_seat_reservations
EXCLUDE USING gist (
  "seatId" WITH =,
  tsrange("startAt", "endAt") WITH &&
)
WHERE ("seatId" IS NOT NULL AND status != 'cancelled');

-- Add exclusion constraint for table reservations (group bookings)
-- Prevents overlapping reservations for the same table
ALTER TABLE reservations
ADD CONSTRAINT no_overlapping_table_reservations
EXCLUDE USING gist (
  "tableId" WITH =,
  tsrange("startAt", "endAt") WITH &&
)
WHERE ("tableId" IS NOT NULL AND "seatId" IS NULL AND status != 'cancelled');

-- Note: These constraints work alongside the application-level transaction locks
-- to provide defense in depth against race conditions
