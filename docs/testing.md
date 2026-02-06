# Testing

## Safe user functions (Delete Account, Pause/Unpause, Delete Venue)

### Manual checklist

- **Non-owner cannot pause/unpause/delete venue**: Sign in as user A, open venue owned by user B (e.g. via direct URL to venue dashboard). Pause, Unpause, and Delete venue should return 403 or be hidden.
- **Deleted venues**: After soft-deleting a venue, it should not appear in Explore or search. Direct link to venue page should 404. Attempting to book should fail with a clear message.
- **Paused venues**: Paused venue can appear in listing but should show "temporarily unavailable" or block booking. Booking widget should show pause message when user checks availability.
- **Delete account**: From Profile, open Danger Zone and delete account (type DELETE, optional reason). After success, user is signed out and redirected to /account-deleted. User’s future reservations are cancelled (USER_DELETED), owned venues are paused.
- **Delete venue**: From venue dashboard, open Danger Zone and delete venue (type venue name or DELETE). Venue disappears from listings; future reservations for that venue are cancelled (VENUE_DELETED).
- **Admin restore** (if implemented): As admin, POST to `/api/admin/venues/[id]/restore` and `/api/admin/users/[id]/restore` to restore soft-deleted venue/user. Restored venue is PAUSED; restored user is ACTIVE (PII not restored).

### Automated tests

- `__tests__/lib/booking-guard.test.ts`: canBookVenue and getVenueBookability for DELETED/PAUSED/owner deleted.
- `__tests__/api/account-delete.test.ts`: 401 without auth, 400 without DELETE confirmation, 409 when already deleted, 200 with valid confirmation.
- `__tests__/api/venues-pause-unpause-delete.test.ts`: 401/403 for unauthenticated or non-owner, 409 when venue already deleted.

Run: `npm run test -- --run __tests__/lib/booking-guard.test.ts __tests__/api/account-delete.test.ts __tests__/api/venues-pause-unpause-delete.test.ts`
