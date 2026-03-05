import { clearBookingUIState, clearPendingReservation } from '@/lib/pending-reservation'
import { useEffect } from 'react'

const ClearBookingStateClient = () => {
  useEffect(() => {
    clearPendingReservation()
    clearBookingUIState()
  }, [])

  return null
}

export default ClearBookingStateClient
