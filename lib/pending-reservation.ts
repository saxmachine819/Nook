interface PendingReservation {
  venueId: string
  startAt: string
  endAt: string
  seatId?: string | null
  tableId?: string | null
  seatCount: number
  timestamp: number
}

interface BookingUIState {
  venueId: string
  date: string
  startTime: string
  durationHours: number
  seatCount: number
  selectedSeatId: string | null
  selectedSeatIds: string[]
  selectedGroupTableId: string | null
  availableSeats: any[]
  unavailableSeats: any[]
  availableSeatGroups: any[]
  availableGroupTables: any[]
  unavailableGroupTables: any[]
  unavailableSeatIds: string[]
  timestamp: number
}

const RESERVATION_KEY = 'pending_reservation'
const UI_STATE_KEY = 'booking_ui_state'
const MAX_AGE_MS = 24 * 60 * 60 * 1000

export function storePendingReservation(reservation: Omit<PendingReservation, 'timestamp'>): void {
  if (typeof window === 'undefined') return

  const pending: PendingReservation = {
    ...reservation,
    timestamp: Date.now(),
  }

  try {
    localStorage.setItem(RESERVATION_KEY, JSON.stringify(pending))
  } catch (error) {
    console.error('Failed to store pending reservation:', error)
  }
}

export function getPendingReservation(): PendingReservation | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = localStorage.getItem(RESERVATION_KEY)
    if (!stored) return null

    const pending: PendingReservation = JSON.parse(stored)

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
    localStorage.removeItem(RESERVATION_KEY)
  } catch (error) {
    console.error('Failed to clear pending reservation:', error)
  }
}

export function hasValidPendingReservation(): boolean {
  return getPendingReservation() !== null
}

export function storeBookingUIState(state: Omit<BookingUIState, 'timestamp'>): void {
  if (typeof window === 'undefined') return

  const uiState: BookingUIState = {
    ...state,
    timestamp: Date.now(),
  }

  try {
    localStorage.setItem(UI_STATE_KEY, JSON.stringify(uiState))
  } catch (error) {
    console.error('Failed to store booking UI state:', error)
  }
}

export function getBookingUIState(venueId: string): Omit<BookingUIState, 'timestamp'> | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = localStorage.getItem(UI_STATE_KEY)
    if (!stored) return null

    const uiState: BookingUIState = JSON.parse(stored)

    if (uiState.venueId !== venueId) {
      clearBookingUIState()
      return null
    }

    if (Date.now() - uiState.timestamp > MAX_AGE_MS) {
      clearBookingUIState()
      return null
    }

    const { timestamp, ...rest } = uiState
    return rest
  } catch (error) {
    console.error('Failed to retrieve booking UI state:', error)
    return null
  }
}

export function clearBookingUIState(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(UI_STATE_KEY)
  } catch (error) {
    console.error('Failed to clear booking UI state:', error)
  }
}
