"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { QRAdminPanel } from "./QRAdminPanel"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface QRRedirectWithAdminPanelProps {
  token: string
  venueId: string
  resourceType?: string | null
  resourceId?: string | null
  redirectUrl: string
  delaySeconds?: number
}

export function QRRedirectWithAdminPanel({
  token,
  venueId,
  resourceType,
  resourceId,
  redirectUrl,
  delaySeconds = 3,
}: QRRedirectWithAdminPanelProps) {
  const router = useRouter()
  const [countdown, setCountdown] = useState(delaySeconds)
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else if (!redirecting) {
      setRedirecting(true)
      router.push(redirectUrl)
    }
  }, [countdown, redirecting, redirectUrl, router])

  const handleContinueNow = () => {
    setRedirecting(true)
    router.push(redirectUrl)
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <QRAdminPanel
          token={token}
          venueId={venueId}
          resourceType={resourceType}
          resourceId={resourceId}
        />
        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            {countdown > 0
              ? `Redirecting to booking in ${countdown} second${countdown !== 1 ? "s" : ""}...`
              : "Redirecting..."}
          </p>
          <Button
            variant="outline"
            onClick={handleContinueNow}
            disabled={redirecting}
          >
            <ArrowRight className="mr-2 h-4 w-4" />
            Continue to booking now
          </Button>
        </div>
      </div>
    </div>
  )
}
