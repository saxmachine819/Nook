"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Settings, XCircle, ArrowRight } from "lucide-react"
import { useToast } from "@/components/ui/toast"
import Link from "next/link"

interface QRAdminPanelProps {
  token: string
  venueId: string
  resourceType?: string | null
  resourceId?: string | null
  onActionComplete?: () => void
}

export function QRAdminPanel({
  token,
  venueId,
  resourceType,
  resourceId,
  onActionComplete,
}: QRAdminPanelProps) {
  const router = useRouter()
  const { showToast, ToastComponent } = useToast()
  const [isRetiring, setIsRetiring] = useState(false)

  const handleRetire = async () => {
    if (!confirm("Are you sure you want to retire this QR code? It will no longer be active.")) {
      return
    }

    setIsRetiring(true)

    try {
      const response = await fetch("/api/qr-assets/retire", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      })

      const data = await response.json()

      if (!response.ok) {
        showToast(data.error || "Failed to retire QR code", "error")
        return
      }

      showToast("QR code retired successfully", "success")
      
      // Redirect to scan page to show retired status
      setTimeout(() => {
        router.push(`/q/${token}`)
        router.refresh()
      }, 1000)
    } catch (error: any) {
      console.error("Error retiring QR asset:", error)
      showToast("Failed to retire QR code. Please try again.", "error")
    } finally {
      setIsRetiring(false)
    }
  }

  // Build reassign URL with prefilled params
  const reassignUrl = `/q/${token}/register${venueId ? `?venueId=${venueId}${resourceType ? `&resourceType=${resourceType}` : ""}${resourceId ? `&resourceId=${resourceId}` : ""}` : ""}`

  return (
    <>
      <Card className="border-muted bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground">Admin Controls</p>
            </div>
            <div className="flex gap-2">
              <Button
                asChild
                variant="outline"
                size="sm"
              >
                <Link href={reassignUrl}>
                  <Settings className="mr-2 h-4 w-4" />
                  Reassign
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetire}
                disabled={isRetiring}
              >
                {isRetiring ? (
                  <>
                    <XCircle className="mr-2 h-4 w-4 animate-pulse" />
                    Retiring...
                  </>
                ) : (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    Retire
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      {ToastComponent}
    </>
  )
}
