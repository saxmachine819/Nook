# Migration: Seat-Level Pricing + Media + Metadata

This migration adds seat-level pricing, tags, labels, and image support to the Seat model, and image support to the Table model.

## Schema Changes

### Table Model
- Added `imageUrls` (Json, nullable) - Array of image URLs for the table

### Seat Model
- Added `label` (String, nullable) - Display label for the seat (e.g., "Window seat", "Quiet corner")
- Added `pricePerHour` (Float, required) - Per-seat hourly pricing (replaces venue-level only pricing)
- Added `tags` (Json, nullable) - Array of tags (e.g., ["Outlets", "Quiet corner", "Window"])
- Added `imageUrls` (Json, nullable) - Array of image URLs for the seat

## Migration Steps

### 1. Generate Prisma Client
```bash
npm run db:generate
```

### 2. Create and Apply Migration

**Option A: Using Prisma Migrate (Recommended for production)**

Since `pricePerHour` is required and we may have existing seats, use a two-step approach:

#### Step 2a: Add fields as nullable first
Temporarily modify `schema.prisma` to make `pricePerHour` nullable:
```prisma
pricePerHour Float?  // Temporary: nullable
```

Then create migration:
```bash
npx prisma migrate dev --name add_seat_pricing_and_media_step1
```

#### Step 2b: Backfill data (Step 3 below)

#### Step 2c: Make pricePerHour required
Update `schema.prisma` back to required:
```prisma
pricePerHour Float  // Required
```

Create final migration:
```bash
npx prisma migrate dev --name add_seat_pricing_and_media_step2
```

**Option B: Using Prisma DB Push (Simpler, for development)**

If you're in development and can afford to recreate the database or have no existing seats:

```bash
npx prisma db push
```

This will apply schema changes directly. Then proceed to Step 3 for backfilling.

### 3. Backfill Existing Data

After the migration, run the backfill script to populate `pricePerHour` for existing seats:

```bash
npx tsx scripts/backfill-seat-pricing.ts
```

This script:
- Finds all existing seats
- Sets `pricePerHour` to the venue's `hourlySeatPrice` for each seat
- Skips seats whose venues don't have `hourlySeatPrice` set

### 4. Verify Migration

Check that all seats have `pricePerHour` set:

```sql
SELECT COUNT(*) FROM seats WHERE "pricePerHour" IS NULL;
-- Should return 0
```

## Data Model Notes

### Price Hierarchy
- **Venue level**: `venue.hourlySeatPrice` - Default/base price for the venue
- **Seat level**: `seat.pricePerHour` - Individual seat pricing (can override venue default)

For MVP, we use `seat.pricePerHour` directly. The venue's `hourlySeatPrice` remains as a fallback/default during onboarding.

### JSON Fields
- `tags`: Stored as JSON array, e.g., `["Outlets", "Window", "Quiet"]`
- `imageUrls`: Stored as JSON array, e.g., `["https://...", "https://..."]`

### Backward Compatibility
- Existing seats will have `pricePerHour` backfilled from `venue.hourlySeatPrice`
- New seats must have `pricePerHour` set during creation
- Venue's `hourlySeatPrice` can still be used as a default during seat creation

## Breaking Changes

⚠️ **API Changes Required:**
- Seat creation endpoints must now provide `pricePerHour`
- Booking logic should use `seat.pricePerHour` instead of `venue.hourlySeatPrice`
- Update any queries that calculate pricing to use seat-level pricing

## Rollback (if needed)

If you need to rollback this migration:

```bash
npx prisma migrate resolve --rolled-back add_seat_pricing_and_media
npx prisma migrate dev
```

Then manually remove the fields from `schema.prisma` and regenerate.
