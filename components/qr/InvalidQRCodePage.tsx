import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"

export function InvalidQRCodePage() {
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <CardTitle>Invalid QR code</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This QR code is not recognized. Please check that you scanned the correct code.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
