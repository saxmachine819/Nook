import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2 } from "lucide-react"

interface QRPlaceholderPageProps {
  venueName?: string | null
  resourceType?: string | null
  resourceId?: string | null
}

export function QRPlaceholderPage({
  venueName,
  resourceType,
  resourceId,
}: QRPlaceholderPageProps) {
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <CardTitle>QR Code Assignment</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {venueName && (
              <div>
                <p className="text-sm font-medium">Venue</p>
                <p className="text-sm text-muted-foreground">{venueName}</p>
              </div>
            )}
            {resourceType && (
              <div>
                <p className="text-sm font-medium">Resource Type</p>
                <p className="text-sm text-muted-foreground capitalize">{resourceType}</p>
              </div>
            )}
            {resourceId && (
              <div>
                <p className="text-sm font-medium">Resource ID</p>
                <p className="text-sm text-muted-foreground font-mono">{resourceId}</p>
              </div>
            )}
            {!venueName && !resourceType && !resourceId && (
              <p className="text-sm text-muted-foreground">
                This QR code is active but not yet assigned to a venue or resource.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
