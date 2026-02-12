import { useQuery } from "@tanstack/react-query"

export function useReservationDetail(reservationId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["reservationDetail", reservationId],
    queryFn: async () => {
      const response = await fetch(`/api/reservations/${reservationId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch reservation detail")
      }
      return response.json()
    },
    enabled: !!reservationId && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}
