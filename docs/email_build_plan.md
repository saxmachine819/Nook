# Email build plan (internal map)

## Where bookings are created

- **File:** `app/api/reservations/route.ts`
- **Handler:** POST
- **Table (group) booking:** `prisma.reservation.create` at line 258; then `reservations = [reservation]` (line 302).
- **Seat (individual) booking:** `prisma.reservation.create` at line 385; then `reservations = [reservation]` (line 430).
- **Success path:** Both branches converge; `const reservation = reservations[0]` (line 464); pricing attached; return 201 with reservation (lines 472–477). No other code path creates a reservation.
