"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import { EmbeddedCheckoutView } from "./EmbeddedCheckoutView"

interface EmbeddedCheckoutModalProps {
  clientSecret: string | null
  stripeAccountId?: string | null
  onClose: () => void
}

export function EmbeddedCheckoutModal({
  clientSecret,
  stripeAccountId,
  onClose,
}: EmbeddedCheckoutModalProps) {
  return (
    <Dialog open={!!clientSecret} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl font-bold tracking-tight">
            Complete your reservation
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 min-h-[400px]">
          {!clientSecret ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 py-20">
              <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
              <p className="text-sm text-muted-foreground animate-pulse font-medium">
                Preparing secure checkout...
              </p>
            </div>
          ) : (
            <EmbeddedCheckoutView
              clientSecret={clientSecret}
              stripeAccountId={stripeAccountId}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
