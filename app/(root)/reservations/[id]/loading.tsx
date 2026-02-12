import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function ReservationDetailLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        <Button variant="ghost" size="sm" disabled className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to reservations
        </Button>

        <Card className="overflow-hidden">
          <div className="relative h-64 w-full overflow-hidden bg-muted animate-pulse" />
          <CardContent className="p-6">
            <div className="space-y-6">
              {/* Venue Name Skeleton */}
              <div>
                <div className="h-9 w-2/3 bg-muted animate-pulse rounded-md" />
                <div className="mt-4 flex items-center gap-2">
                  <div className="h-4 w-4 bg-muted animate-pulse rounded-full" />
                  <div className="h-4 w-1/2 bg-muted animate-pulse rounded-md" />
                </div>
              </div>

              {/* Date & Time Skeleton */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 bg-muted animate-pulse rounded-full" />
                  <div className="h-4 w-1/3 bg-muted animate-pulse rounded-md" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 bg-muted animate-pulse rounded-full" />
                  <div className="h-4 w-1/4 bg-muted animate-pulse rounded-md" />
                </div>
              </div>

              {/* Seat Info Skeleton */}
              <div className="space-y-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded-md" />
                <div className="h-4 w-32 bg-muted animate-pulse rounded-md" />
              </div>

              {/* Price Breakdown Skeleton */}
              <div className="rounded-md border bg-muted/30 p-4">
                <div className="h-4 w-32 bg-muted animate-pulse rounded-md mb-4" />
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <div className="h-4 w-1/2 bg-muted animate-pulse rounded-md" />
                    <div className="h-4 w-1/4 bg-muted animate-pulse rounded-md" />
                  </div>
                  <div className="border-t pt-2 flex justify-between">
                    <div className="h-4 w-1/4 bg-muted animate-pulse rounded-md" />
                    <div className="h-6 w-1/5 bg-muted animate-pulse rounded-md" />
                  </div>
                </div>
              </div>

              {/* Actions Skeleton */}
              <div className="flex flex-col gap-2 pt-4">
                <div className="h-10 w-full bg-muted animate-pulse rounded-md" />
                <div className="h-10 w-full bg-muted animate-pulse rounded-md" />
                <div className="h-10 w-full bg-muted animate-pulse rounded-md" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
