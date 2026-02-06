/**
 * Dev-only helper for hours audit diagnostics.
 * See docs/HOURS_AUDIT.md. Safe to remove when stripping diagnostics.
 */

export type HoursSource = "venue_hours" | "opening_hours_json" | "fallback" | "none"

type VenueHoursLike = Array<{
  dayOfWeek: number
  isClosed?: boolean
  openTime?: string | null
  closeTime?: string | null
}> | null

/**
 * Infer which hours source is used for interval/label logic given venue data.
 * venue_hours = VenueHours table used; opening_hours_json = raw Google JSON periods used;
 * fallback = default 8:00–20:00 or similar; none = no hours data.
 */
export function getHoursSource(
  venueHours: VenueHoursLike,
  openingHoursJson: unknown
): HoursSource {
  if (venueHours && venueHours.length > 0) return "venue_hours"
  const periods =
    openingHoursJson &&
    typeof openingHoursJson === "object" &&
    "periods" in openingHoursJson &&
    Array.isArray((openingHoursJson as { periods?: unknown[] }).periods) &&
    (openingHoursJson as { periods: unknown[] }).periods.length > 0
  if (periods) return "opening_hours_json"
  if (openingHoursJson || venueHours) return "fallback"
  return "none"
}
