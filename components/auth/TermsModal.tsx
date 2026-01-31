"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const TERMS_CONTENT = (
  <>
    <p className="mb-4">
      By creating an account and using Nook, you agree to the following:
    </p>

    <h3 className="font-semibold mt-4 mb-2">Reservations & Payments</h3>
    <ul className="list-disc pl-5 space-y-1 mb-4">
      <li>All reservations are final.</li>
      <li>Unused time, early departures, and no-shows are not refundable.</li>
      <li>Prices are shown before booking and may vary by venue.</li>
    </ul>

    <h3 className="font-semibold mt-4 mb-2">If a Reserved Seat Is Occupied</h3>
    <ul className="list-disc pl-5 space-y-1 mb-4">
      <li>If your seat is occupied, notify venue staff immediately.</li>
      <li>Do not confront other patrons.</li>
      <li>
        Venues are expected to make reasonable efforts to resolve the issue or
        provide a comparable seat.
      </li>
      <li>
        If the issue cannot be resolved, you may report it to Nook for review.
        Refunds or credits are not guaranteed and are handled case-by-case.
      </li>
    </ul>

    <h3 className="font-semibold mt-4 mb-2">Venue Expectations</h3>
    <p className="mb-4">
      Venues are expected to clearly identify Nook seats and make reasonable
      efforts to honor reservations. Nook does not control venue staff or
      operations.
    </p>

    <h3 className="font-semibold mt-4 mb-2">User Expectations</h3>
    <p className="mb-2">You agree to:</p>
    <ul className="list-disc pl-5 space-y-1 mb-4">
      <li>Arrive on time and respect reservation times</li>
      <li>Use only your assigned seat</li>
      <li>Follow venue rules and behave respectfully</li>
      <li>Leave the seat promptly when your reservation ends</li>
    </ul>
    <p className="mb-4">
      Misuse or repeated issues may result in account suspension or removal.
    </p>

    <h3 className="font-semibold mt-4 mb-2">Platform Disclaimer</h3>
    <p className="mb-4">
      Nook facilitates reservations but does not own or operate venues. Nook is
      not responsible for lost items, venue disputes, or seating issues beyond
      reasonable review.
    </p>

    <p className="text-sm text-muted-foreground mt-4">
      By checking &quot;I Agree&quot;, you confirm that you have read and accept
      Nook&apos;s full Terms & Conditions.
    </p>
  </>
)

interface TermsModalProps {
  trigger: React.ReactNode
}

export function TermsModal({ trigger }: TermsModalProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Nook – User Agreement</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto pr-2 text-sm">{TERMS_CONTENT}</div>
      </DialogContent>
    </Dialog>
  )
}

export function TermsModalContent() {
  return (
    <div className="overflow-y-auto pr-2 text-sm space-y-0">
      {TERMS_CONTENT}
    </div>
  )
}
