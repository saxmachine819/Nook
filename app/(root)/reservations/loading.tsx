import { Card, CardContent } from "@/components/ui/card"
import { ChevronRight, Clock } from "lucide-react"

export default function ReservationsLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 pt-2 pb-6">
        {/* Tabs Skeleton */}
        <div className="mb-3 flex gap-2 border-b -mx-4 px-4">
          <div className="h-9 w-24 border-b-2 border-primary animate-pulse" />
          <div className="h-9 w-16 animate-pulse" />
          <div className="h-9 w-20 animate-pulse" />
        </div>

        {/* Hero Card Skeleton */}
        <Card className="overflow-hidden border-none shadow-none sm:border sm:shadow-sm">
          <div className="h-64 sm:h-80 w-full bg-muted animate-pulse" />
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="h-7 w-2/3 bg-muted animate-pulse rounded" />
                <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
              </div>
              <div className="h-5 w-1/3 bg-muted animate-pulse rounded" />
              <div className="h-5 w-1/4 bg-muted animate-pulse rounded" />
              <div className="h-10 w-full bg-muted animate-pulse rounded" />
              <div className="h-20 w-full bg-muted/50 animate-pulse rounded" />
            </div>
          </CardContent>
        </Card>

        {/* List Items Skeleton */}
        <div className="mt-6 space-y-3">
          <div className="h-4 w-20 bg-muted animate-pulse rounded mb-2" />
          {[1, 2, 3].map((i) => (
            <Card key={i} className="cursor-default">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-1/2 bg-muted animate-pulse rounded" />
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 bg-muted animate-pulse rounded-full" />
                    <div className="h-3 w-1/3 bg-muted animate-pulse rounded" />
                  </div>
                </div>
                <div className="h-5 w-5 bg-muted animate-pulse rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
