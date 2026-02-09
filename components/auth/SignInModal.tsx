"use client"

import React, { useState, useEffect } from "react"
import { useSession, signIn } from "next-auth/react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { LogIn } from "lucide-react"

interface SignInModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSignInSuccess?: () => void
  /** Override default description (e.g. "Sign in to complete your reservation.") */
  description?: string
  /** Override callback URL after OAuth (default: current path + search) */
  callbackUrl?: string
}

const DEFAULT_DESCRIPTION = "Sign in to reserve seats and manage your reservations."

export function SignInModal({
  open,
  onOpenChange,
  onSignInSuccess,
  description = DEFAULT_DESCRIPTION,
  callbackUrl,
}: SignInModalProps) {
  const { data: session, status } = useSession()
  const [isSigningIn, setIsSigningIn] = useState(false)

  // Close modal and call success callback when user signs in
  useEffect(() => {
    if (session && open) {
      setIsSigningIn(false)
      onOpenChange(false)
      if (onSignInSuccess) {
        onSignInSuccess()
      }
    }
  }, [session, open, onOpenChange, onSignInSuccess])

  const handleSignIn = async () => {
    setIsSigningIn(true)
    const url =
      callbackUrl ?? (typeof window !== "undefined" ? window.location.pathname + window.location.search : "/")
    await signIn("google", { callbackUrl: url })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign in to continue</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="pt-4">
          <Button
            onClick={handleSignIn}
            className="w-full"
            size="lg"
            disabled={isSigningIn || status === "loading"}
          >
            <LogIn className="mr-2 h-4 w-4" />
            {isSigningIn ? "Signing in..." : "Sign in with Google"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
