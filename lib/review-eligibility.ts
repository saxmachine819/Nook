/**
 * Determines whether a reservation can be reviewed.
 * Mirrors the "past" tab definition used in app/api/reservations/route.ts
 * (status !== "cancelled" AND endAt < now) so reviews are only allowed on
 * reservations that would show up there.
 */
export function isReservationReviewable(
  reservation: { status: string; endAt: Date | string },
  now: Date = new Date()
): boolean {
  const endAt = typeof reservation.endAt === "string" ? new Date(reservation.endAt) : reservation.endAt
  return reservation.status !== "cancelled" && endAt < now
}

export function isValidRating(rating: unknown): rating is number {
  return typeof rating === "number" && Number.isInteger(rating) && rating >= 1 && rating <= 5
}
