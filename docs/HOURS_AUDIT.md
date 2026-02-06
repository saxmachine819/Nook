# Opening Hours — Audit (sources, computation, consumers)

Internal reference for where hours come from, where they are computed, and who consumes them. Used by dev-only diagnostics; see log comments and `lib/hours-debug.ts`.

## Where hours come from

| Source | Storage | When populated |
|--------|--------|----------------|
| **A) Raw Google hours payload** | `Venue.openingHoursJson` (Json) | Google Place Details; venue create/update (API and dashboard). Contains `periods` and optionally `weekdayDescriptions`. |
| **B) Editable venue profile hours** | `VenueHours` table (`dayOfWeek`, `openTime`, `closeTime`, `isClosed`, `source`); `Venue.hoursSource`, `Venue.hoursUpdatedAt`, `Venue.timezone` | Written via `syncVenueHoursFromGoogle` (Google) or PATCH with `venueHours` (manual). When manual, venue gets `hoursSource: "manual"` and `hoursUpdatedAt`. |
| **C) Derived "isOpenNow"** | Not stored | Computed on demand by `lib/venue-hours.ts` `isVenueOpenNow()` and `lib/availability-utils.ts` `computeAvailabilityLabel()`. Prefers VenueHours; falls back to `openingHoursJson.periods`. |
| **D) Caching** | None | No dedicated cache; explore, venue page, and APIs load venue + `venueHours` + `openingHoursJson` from DB per request. |

**Single source of truth for logic:** `lib/venue-hours.ts` and `lib/availability-utils.ts`.

## Where hours are computed

- **Parsing Google → VenueHours:** `parseGooglePeriodsToVenueHours` in `lib/venue-hours.ts`; called when saving venue (dashboard, API create/update).
- **Open intervals for a date:** `getOpenIntervalsFromVenueHours(venueHours, dateStr)` or inline parsing of `openingHoursJson.periods` in `app/api/venues/[id]/availability/route.ts` `getOpenIntervalsForDate`.
- **Is venue open now:** `isVenueOpenNow(openingHoursJson, timezone, venueHours)` in `lib/venue-hours.ts`. Timezone is never passed; effective timezone is server or client local.
- **Availability label:** `computeAvailabilityLabel(...)` in `lib/availability-utils.ts` (calls `isVenueOpenNow`, `getNextOpenTime`).
- **Reservation within hours:** `isReservationWithinHours(...)` in `lib/venue-hours.ts`.

## Consumers (4 surfaces)

1. **Booking validation / availability** — `app/api/venues/[id]/availability/route.ts` (slots via `getOpenIntervalsForDate`; window check via `isReservationWithinHours`); `app/api/reservations/route.ts` (POST, `isReservationWithinHours`).
2. **Map pin color** — `components/map/MapboxMap.tsx` uses `availabilityLabel` (green if "Available now", else red). Label produced by explore (page or search API).
3. **Explore venue card bubble** — `app/(root)/page.tsx` and `app/api/venues/search/route.ts` call `computeAvailabilityLabel` and pass `availabilityLabel` to VenueCard / ResultsDrawer / map.
4. **Venue booking page** — `app/(root)/venue/[id]/page.tsx` uses `computeAvailabilityLabel` for bubble and passes `openingHoursJson` to `VenueHoursDisplay`. `components/venue/VenueHoursDisplay.tsx` uses only `openingHoursJson` for display and "Open now".

## Precedence (canonical)

- **Manual wins:** If `venue.hoursSource === "manual"`, only VenueHours rows with `source = "manual"` are used for availability and labels. Google sync must not overwrite them (`syncVenueHoursFromGoogle` skips days that already have a manual row).
- **Google default:** If `venue.hoursSource` is null or `"google"`, only VenueHours rows with `source = "google"` are used (and fallback to `openingHoursJson` where needed).
- **Effective hours:** Call `getEffectiveVenueHours(venue.venueHours, venue.hoursSource)` before passing to interval/label/reservation logic.

## Shared hours engine (lib/hours)

The canonical “hours engine” is **`lib/hours`**:

- **`getCanonicalVenueHours(venueId)`** — Loads venue + venueHours, applies precedence (`getEffectiveVenueHours`), returns `{ timezone, weeklyHours }`. Timezone defaults to `America/New_York` when missing.
- **`getOpenStatus(canonical, at)`** — Computes open/closed at a given UTC `Date`, using **venue timezone** only (not viewer or server). Returns `isOpen`, `status` (OPEN_NOW, CLOSED_NOW, OPENS_LATER, CLOSED_TODAY), `todayLabel`, `todayHoursText`, optional `nextOpenAt`, and optional `diagnosticMessage` for admin when open/close data is invalid.

**How timezone is applied:** The input `at` is one moment in time (UTC). We use `Intl.DateTimeFormat(..., { timeZone: canonical.timezone }).formatToParts(at)` to get the **local** date and time in that zone (weekday, hour, minute). “Today” and the current time for the venue are always in **venue timezone**. We compare that venue-local time to the stored weekly hours (day-of-week + HH:MM). For `nextOpenAt`, we compute the UTC `Date` that corresponds to “today (or next open day) at openTime” in the venue timezone, using the same timezone so “opens at 9:00 AM” is 9:00 AM in the venue’s zone.

## Timezone

- **Stored:** `Venue.timezone` (optional). Hours are day-of-week + local time (HH:MM).
- **In lib/hours:** Venue timezone is used for all open/closed and next-open logic; default `America/New_York` when null.
- **Elsewhere:** If not set, effective timezone may be local to the process (server/client); see `lib/venue-hours` and `lib/availability-utils` for legacy behavior.
