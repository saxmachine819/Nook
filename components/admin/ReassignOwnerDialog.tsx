"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/toast"

interface ReassignOwnerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  venueId: string
  venueName: string
  currentOwnerEmail: string | null
  onSuccess: () => void
}

export function ReassignOwnerDialog({
  open,
  onOpenChange,
  venueId,
  venueName,
  currentOwnerEmail,
  onSuccess,
}: ReassignOwnerDialogProps) {
  const { showToast, ToastComponent } = useToast()
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/venues/${venueId}/reassign-owner`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ownerEmail: email.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to reassign owner")
        return
      }

      showToast("Owner reassigned successfully", "success")
      setEmail("")
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error("Error reassigning owner:", error)
      setError("Failed to reassign owner. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setEmail("")
    setError(null)
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Owner</DialogTitle>
            <DialogDescription>
              Reassign ownership of <strong>{venueName}</strong> to a different user.
              {currentOwnerEmail && (
                <span className="block mt-1 text-xs">
                  Current owner: {currentOwnerEmail}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="owner-email">New Owner Email</Label>
                <Input
                  id="owner-email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setError(null)
                  }}
                  disabled={isLoading}
                  required
                />
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reassigning...
                  </>
                ) : (
                  "Reassign Owner"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {ToastComponent}
    </>
  )
}
