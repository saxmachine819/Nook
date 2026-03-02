/**
 * Pending Reservation Storage
 *
 * Stores reservation details in localStorage so they survive OAuth redirects.
 * This allows users to select seats, sign in, and then complete their reservation.
 */

interface PendingReservation {
  venueId: string
  startAt: string
  endAt: string
  seatId?: string | null
  tableId?: string | null
  seatCount: number
  timestamp: number
}

const STORAGE_KEY = 'pending_reservation'
const MAX_AGE_MS = 24 * 60 * 60 * 1000

export function storePendingReservation(reservation: Omit<PendingReservation, 'timestamp'>): void {
  if (typeof window === 'undefined') return

  const pending: PendingReservation = {
    ...reservation,
    timestamp: Date.now(),
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pending))
  } catch (error) {
    console.error('Failed to store pending reservation:', error)
  }
}

export function getPendingReservation(): PendingReservation | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null

    const pending: PendingReservation = JSON.parse(stored)

    // Check if expired
    if (Date.now() - pending.timestamp > MAX_AGE_MS) {
      clearPendingReservation()
      return null
    }

    return pending
  } catch (error) {
    console.error('Failed to retrieve pending reservation:', error)
    return null
  }
}

export function clearPendingReservation(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('Failed to clear pending reservation:', error)
  }
}

export function hasValidPendingReservation(): boolean {
  return getPendingReservation() !== null
}
