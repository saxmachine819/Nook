import type { User } from "@prisma/client"

/**
 * Check if a user is an admin based on their email.
 * Admins are defined in the ADMIN_EMAILS environment variable (comma-separated).
 */
export function isAdmin(user: { email?: string | null } | null | undefined): boolean {
  if (!user?.email) {
    return false
  }

  const adminEmails = process.env.ADMIN_EMAILS
  if (!adminEmails) {
    return false
  }

  const adminEmailList = adminEmails.split(",").map((email) => email.trim().toLowerCase())
  return adminEmailList.includes(user.email.toLowerCase())
}

/**
 * Check if a user can edit a venue.
 * Returns true if:
 * - The user is the owner of the venue (user.id === venue.ownerId), OR
 * - The user is an admin (email in ADMIN_EMAILS)
 * 
 * For venues with ownerId = null (legacy venues), only admins can edit.
 */
export function canEditVenue(
  user: { id: string; email?: string | null } | null | undefined,
  venue: { ownerId: string | null }
): boolean {
  if (!user) {
    return false
  }

  // Admins can edit any venue, including legacy venues (ownerId = null)
  if (isAdmin(user)) {
    return true
  }

  // For legacy venues (ownerId = null), only admins can edit
  if (!venue.ownerId) {
    return false
  }

  // Owner can edit their own venue
  return user.id === venue.ownerId
}
