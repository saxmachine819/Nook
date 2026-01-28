import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/venue-auth"

/**
 * Set venue approval status (APPROVED or REJECTED).
 * Only admins (defined in ADMIN_EMAILS) can use this function.
 * 
 * @param venueId - The ID of the venue to update
 * @param status - Either "APPROVED" or "REJECTED"
 * @param user - The user attempting to approve/reject (must be admin)
 * @param rejectionReason - Optional reason for rejection
 * @returns Object with success boolean and optional error message
 */
export async function setVenueApprovalStatus(
  venueId: string,
  status: "APPROVED" | "REJECTED",
  user: { email?: string | null },
  rejectionReason?: string
): Promise<{ success: boolean; error?: string }> {
  // Check admin access
  if (!isAdmin(user)) {
    return { success: false, error: "Unauthorized: Admin access required" }
  }

  // Verify venue exists
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { id: true },
  })

  if (!venue) {
    return { success: false, error: "Venue not found" }
  }

  // Update venue with status and timestamp
  const updateData: any = {
    onboardingStatus: status,
  }

  if (status === "APPROVED") {
    updateData.approvedAt = new Date()
    updateData.rejectedAt = null
    updateData.rejectionReason = null
  } else if (status === "REJECTED") {
    updateData.rejectedAt = new Date()
    updateData.rejectionReason = rejectionReason || null
    updateData.approvedAt = null
  }

  try {
    await prisma.venue.update({
      where: { id: venueId },
      data: updateData,
    })

    return { success: true }
  } catch (error: any) {
    console.error("Error updating venue approval status:", error)
    return { success: false, error: error?.message || "Failed to update venue status" }
  }
}
