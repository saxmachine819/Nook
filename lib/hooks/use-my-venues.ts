import { useQuery } from "@tanstack/react-query"

export interface MyVenuesCountResponse {
  count: number
}

export function useMyVenuesCount(enabled: boolean = true) {
  return useQuery<MyVenuesCountResponse>({
    queryKey: ["my-venues-count"],
    queryFn: async () => {
      const response = await fetch("/api/users/me/venues?mode=count")
      if (!response.ok) {
        throw new Error("Failed to fetch venue count")
      }
      return response.json()
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
