# Changelog

## [Unreleased]

### QR Code Implementation

- **QR Assets (database)**: Added `QRAsset` model with token, status, venue/resource assignment, batch tracking. See `prisma/schema.prisma` and `QR_ASSETS_MIGRATION_STEPS.md`.
- **Batch create**: Admin-only `POST /api/admin/qr-assets/batch-create` to generate unique QR tokens (see `BATCH_CREATE_QR_ASSETS_TESTING.md`, `QR_TESTING_GUIDE.md`).
- **Public scan**: `GET /q/[token]` — invalid / unregistered / active / retired handling; active QRs redirect with preselection; scan events logged.
- **Registration**: Protected `/q/[token]/register` and `POST /api/qr-assets/assign`; resource type (seat/table) and booking-mode–aware options (group tables only for table assignment). See `QR_REGISTRATION_TESTING.md`.
- **Admin controls**: On active QR scan, venue admins see Reassign + Retire; `POST /api/qr-assets/reassign`, `POST /api/qr-assets/retire`. See `QR_ADMIN_CONTROLS_TESTING.md`.
- **Sticker SVG**: `GET /api/qr-assets/[token]/sticker.svg` — print-ready SVG with Nooc logo, top/bottom text, high error correction. Venue dashboard QR stickers page: `/venue/dashboard/[id]/qr-stickers`.
- **Batch PDF**: Admin-only `GET /api/admin/qr-assets/batch/[batchId]/print.pdf`; internal admin page `/admin/qr-assets/batch/[batchId]`. See `QR_BATCH_PDF_EXPORT.md`.
- **Utilities**: `lib/qr-asset-utils.ts`, `lib/qr-logo-utils.ts`, `lib/qr-sticker-generator.ts`; scripts: `create-single-qr.ts`, `create-test-qr.ts`, `verify-qr-assets.ts`, `test-batch-create.sh`.

### Explore UX

- **Results drawer**: The results list no longer auto-expands when the user applies filters and hits Search. It still auto-expands when there is a non-empty text search query. Users can open the list manually via the drawer handle or expand control. See `app/(root)/ExploreClient.tsx` (`autoExpand` prop on `ResultsDrawer`).

### Other

- **Venue resources API**: `GET /api/venues/[id]/resources` for QR registration form (tables/seats by booking mode).
- **Auth / Venue**: `lib/venue-auth.ts` — `canRegisterQR`; dependency and schema updates as needed for QR and admin flows.
