"use client"

export function CancelReservationButton({
  reservationId,
  disabled,
}: {
  reservationId: string
  disabled: boolean
}) {
  const handleCancel = async () => {
    if (disabled) return

    try {
      const response = await fetch(`/api/reservations/${reservationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "cancelled" }),
      })

      if (!response.ok) {
        console.error("Failed to cancel reservation")
        return
      }

      // For MVP, a simple refresh is fine to reflect the updated status.
      // TODO: Replace with client-side state update for a smoother UX.
      window.location.reload()
    } catch (error) {
      console.error("Failed to cancel reservation:", error)
    }
  }

  return (
    <button
      onClick={handleCancel}
      disabled={disabled}
      className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground/50"
    >
      {disabled ? "Cancelled" : "Cancel"}
    </button>
  )
}
