"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Settings, LogIn } from "lucide-react"
import Link from "next/link"

interface UnregisteredQRPageProps {
  token: string
  canRegister: boolean
}

export function UnregisteredQRPage({ token, canRegister }: UnregisteredQRPageProps) {
  const callbackUrl = `/q/${token}`

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              <CardTitle>This Nooc QR hasn't been set up yet</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This QR code needs to be registered and assigned to a venue before it can be used for
              bookings.
            </p>
            <div className="flex flex-col gap-2">
              {!canRegister && (
                <Button asChild variant="default">
                  <Link href={`/profile?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
                    <LogIn className="mr-2 h-4 w-4" />
                    Log in to register
                  </Link>
                </Button>
              )}
              {canRegister && (
                <Button asChild variant="default">
                  <Link href={`/q/${token}/register`}>
                    <Settings className="mr-2 h-4 w-4" />
                    Register this QR code
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
