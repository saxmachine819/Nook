import { Calendar } from "lucide-react"

export default function ReservationsPage() {
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">
        Reservations
      </h1>
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="mb-2 text-xl font-semibold">No reservations yet</h2>
        <p className="text-sm text-muted-foreground">
          When you reserve a seat, it will appear here.
        </p>
      </div>
    </div>
  )
}