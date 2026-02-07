"use client"

import { createContext, useContext, type ReactNode } from "react"

export type VenueRole = "admin" | "staff" | null

const VenueRoleContext = createContext<VenueRole>(null)

export function VenueRoleProvider({
  venueRole,
  children,
}: {
  venueRole: VenueRole
  children: ReactNode
}) {
  return (
    <VenueRoleContext.Provider value={venueRole}>
      {children}
    </VenueRoleContext.Provider>
  )
}

export function useVenueRole(): VenueRole {
  return useContext(VenueRoleContext)
}
