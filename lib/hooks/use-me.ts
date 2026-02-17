import { useQuery } from "@tanstack/react-query"

export interface UserMeResponse {
  id: string
  email: string | null
  name: string | null
  isAdmin: boolean
}

export function useMe(enabled: boolean = true) {
  return useQuery<UserMeResponse>({
    queryKey: ["user-me"],
    queryFn: async () => {
      const response = await fetch("/api/users/me")
      if (!response.ok) {
        throw new Error("Failed to fetch user metadata")
      }
      return response.json()
    },
    enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}
