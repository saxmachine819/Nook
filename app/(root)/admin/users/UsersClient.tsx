"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Search, X, Building2, Calendar, User as UserIcon, Mail, Clock } from "lucide-react"
import { UserDetailModal } from "@/components/admin/UserDetailModal"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface UserListItem {
  id: string
  name: string | null
  email: string | null
  createdAt: Date | string
  isAdmin: boolean
  venuesOwnedCount: number
  reservationsCount: number
  lastReservationAt: Date | string | null
}

interface UsersClientProps {
  initialUsers: UserListItem[]
  initialSearchQuery: string
}

export function UsersClient({ initialUsers, initialSearchQuery }: UsersClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [users, setUsers] = useState<UserListItem[]>(initialUsers)
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  // Removed selectedUserId state since cards are not clickable for now
  const [isLoading, setIsLoading] = useState(false)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Debug logging
  useEffect(() => {
    console.log('[UsersClient] Received initialUsers:', initialUsers.length, initialUsers)
    console.log('[UsersClient] Current users state:', users.length, users)
  }, [initialUsers, users])

  // Update search query in URL
  const updateSearch = (query: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (query.trim()) {
      params.set("search", query.trim())
    } else {
      params.delete("search")
    }
    router.push(`/admin/users?${params.toString()}`)
  }

  // Debounce search (only if search query actually changed from initial)
  useEffect(() => {
    // Don't trigger search on initial mount if query matches initial
    if (searchQuery === initialSearchQuery) {
      return
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      updateSearch(searchQuery)
    }, 300)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [searchQuery, initialSearchQuery])

  // Sync users with initialUsers prop when it changes (from server re-render)
  useEffect(() => {
    setUsers(initialUsers)
  }, [initialUsers])

  const formatDate = (date: Date | string | null) => {
    if (!date) return "Never"
    const dateObj = typeof date === "string" ? new Date(date) : date
    return dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const formatDateTime = (date: Date | string | null) => {
    if (!date) return "Never"
    const dateObj = typeof date === "string" ? new Date(date) : date
    return dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const handleClearSearch = () => {
    setSearchQuery("")
    updateSearch("")
  }

  // Debug: Log before rendering
  console.log('[UsersClient] Render check - users.length:', users.length, 'isLoading:', isLoading)

  if (users.length === 0 && !isLoading) {
    return (
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by email or name..."
            className="w-full rounded-md border border-input bg-background px-10 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>No users found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {searchQuery ? "No users match your search." : "There are no users in the system."}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by email or name..."
            className="w-full rounded-md border border-input bg-background px-10 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Users List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">Loading users...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Column Headers - Hidden on mobile, shown on desktop */}
            <div className="hidden md:grid md:grid-cols-7 gap-4 px-4 py-2 border-b text-xs font-medium text-muted-foreground">
              <div className="md:col-span-2">Name / Email</div>
              <div>Joined</div>
              <div>Role</div>
              <div>Venues</div>
              <div>Reservations</div>
              <div>Last Reservation</div>
            </div>

            {/* User Rows */}
            {users.map((user) => (
              <Card
                key={user.id}
                className="transition-colors"
              >
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-7 md:items-center">
                    {/* Name */}
                    <div className="flex items-center gap-2 md:col-span-2">
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{user.name || "No name"}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {user.email || "No email"}
                        </p>
                      </div>
                    </div>

                    {/* Created At */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span className="hidden md:inline">Joined: </span>
                      {user.createdAt ? formatDate(user.createdAt) : "N/A"}
                    </div>

                    {/* Is Admin */}
                    <div>
                      {user.isAdmin ? (
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                          Admin
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">User</span>
                      )}
                    </div>

                    {/* Venues Owned */}
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{user.venuesOwnedCount}</span>
                    </div>

                    {/* Reservations */}
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{user.reservationsCount}</span>
                    </div>

                    {/* Last Reservation */}
                    <div className="text-sm text-muted-foreground">
                      {formatDate(user.lastReservationAt)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* User detail modal removed for now - cards are not clickable */}
    </>
  )
}
