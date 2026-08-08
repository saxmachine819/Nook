"use client"

import { Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { nativeShare } from "@/lib/native-actions"

interface ShareVenueButtonProps {
  venueName: string
  url: string
  className?: string
}

export function ShareVenueButton({
  venueName,
  url,
  className,
}: ShareVenueButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      onClick={() =>
        void nativeShare({
          title: venueName,
          text: `Reserve a workspace at ${venueName} on Nooc`,
          url,
          dialogTitle: "Share venue",
        })
      }
    >
      <Share2 className="h-4 w-4 mr-2" />
      Share
    </Button>
  )
}
