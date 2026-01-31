"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { TermsAgreementCheckbox } from "@/components/auth/TermsAgreementCheckbox"

export function TermsGate({ children }: { children: React.ReactNode }) {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mustAccept =
    status === "authenticated" &&
    session?.user &&
    (session.user as { termsAcceptedAt?: Date | null }).termsAcceptedAt == null

  if (status === "loading" || !mustAccept) {
    return <>{children}</>
  }

  const handleAccept = async () => {
    if (!agreed) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/users/me/accept-terms", { method: "POST" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "Something went wrong. Please try again.")
        return
      }
      await update()
      router.refresh()
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Accept Terms to Continue</h1>
        <p className="text-sm text-muted-foreground">
          To use Nook, you must read and accept our Terms & Conditions.
        </p>
        <TermsAgreementCheckbox
          checked={agreed}
          onCheckedChange={setAgreed}
          disabled={loading}
        />
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button
          onClick={handleAccept}
          disabled={!agreed || loading}
          className="w-full"
        >
          {loading ? "Continuing..." : "I Agree"}
        </Button>
      </div>
    </div>
  )
}
