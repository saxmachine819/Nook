import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { XCircle } from "lucide-react"

export function RetiredQRPage() {
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-muted-foreground" />
              <CardTitle>This QR code is no longer active</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This QR code has been retired and is no longer in use.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
