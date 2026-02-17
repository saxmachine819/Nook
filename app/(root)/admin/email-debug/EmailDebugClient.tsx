"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const TO_EMAIL_TRUNCATE = 40
const STATUS_OPTIONS = ["", "PENDING", "SENT", "FAILED"] as const
const TYPE_OPTIONS = [
  "",
  "booking_confirmation",
  "booking_canceled",
  "venue_booking_created",
  "venue_booking_canceled",
  "welcome_user",
  "welcome",
  "booking_end_5min",
  "venue_approved",
  "customer_follow_up",
] as const

export interface EmailDebugEvent {
  id: string
  createdAt: string
  type: string
  status: string
  toEmail: string
  userId: string | null
  venueId: string | null
  bookingId: string | null
  payload: unknown
  error: string | null
  sentAt: string | null
  subject: string
}

interface EmailDebugClientProps {
  events: EmailDebugEvent[]
  initialStatusFilter: string
  initialTypeFilter: string
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max) + "..."
}

function formatPayload(payload: unknown): string {
  try {
    return JSON.stringify(payload, null, 2)
  } catch {
    return String(payload)
  }
}

export function EmailDebugClient({
  events,
  initialStatusFilter,
  initialTypeFilter,
}: EmailDebugClientProps) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter)
  const [typeFilter, setTypeFilter] = useState(initialTypeFilter)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [dispatchLoading, setDispatchLoading] = useState(false)
  const [dispatchMessage, setDispatchMessage] = useState<string | null>(null)

  useEffect(() => {
    setStatusFilter(initialStatusFilter)
    setTypeFilter(initialTypeFilter)
  }, [initialStatusFilter, initialTypeFilter])

  const applyFilters = (status: string, type: string) => {
    const params = new URLSearchParams()
    if (status) params.set("status", status)
    if (type) params.set("type", type)
    router.push(`/admin/email-debug?${params.toString()}`)
  }

  const handleStatusChange = (value: string) => {
    setStatusFilter(value)
    applyFilters(value, typeFilter)
  }

  const handleTypeChange = (value: string) => {
    setTypeFilter(value)
    applyFilters(statusFilter, value)
  }

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const handleRunDispatcher = async () => {
    setDispatchLoading(true)
    setDispatchMessage(null)
    try {
      const res = await fetch("/api/admin/email/run-dispatcher", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setDispatchMessage(
          `Processed ${data.processed ?? 0}, sent ${data.sent ?? 0}, failed ${data.failed ?? 0}`
        )
        router.refresh()
      } else {
        setDispatchMessage(data.error ?? "Failed to run dispatcher")
      }
    } catch {
      setDispatchMessage("Request failed")
    } finally {
      setDispatchLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            Status
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="rounded border bg-background px-2 py-1 text-sm"
            >
              <option value="">All</option>
              {STATUS_OPTIONS.filter(Boolean).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            Type
            <select
              value={typeFilter}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="rounded border bg-background px-2 py-1 text-sm"
            >
              <option value="">All</option>
              {TYPE_OPTIONS.filter(Boolean).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleRunDispatcher}
            disabled={dispatchLoading}
          >
            {dispatchLoading ? "Running…" : "Run dispatcher"}
          </Button>
        </div>
        {dispatchMessage && (
          <p
            className={cn(
              "mb-4 text-sm",
              dispatchMessage.startsWith("Processed")
                ? "text-muted-foreground"
                : "text-destructive"
            )}
          >
            {dispatchMessage}
          </p>
        )}

        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events match the filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 font-medium">Created at</th>
                  <th className="p-2 font-medium">Type</th>
                  <th className="p-2 font-medium">Status</th>
                  <th className="p-2 font-medium">To</th>
                  <th className="p-2 font-medium">Booking ID</th>
                  <th className="p-2 font-medium">Venue ID</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <React.Fragment key={event.id}>
                    <tr
                      className="cursor-pointer border-b hover:bg-muted/50"
                      onClick={() => toggleExpand(event.id)}
                    >
                      <td className="p-2 whitespace-nowrap">{new Date(event.createdAt).toLocaleString()}</td>
                      <td className="p-2">{event.type}</td>
                      <td className="p-2">
                        <span
                          className={cn(
                            "inline-block rounded px-1.5 py-0.5 text-xs font-medium",
                            event.status === "PENDING" && "bg-muted text-muted-foreground",
                            event.status === "SENT" && "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
                            event.status === "FAILED" && "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                          )}
                        >
                          {event.status}
                        </span>
                      </td>
                      <td className="p-2" title={event.toEmail}>
                        {truncate(event.toEmail, TO_EMAIL_TRUNCATE)}
                      </td>
                      <td className="p-2 font-mono text-xs">{event.bookingId ?? "—"}</td>
                      <td className="p-2 font-mono text-xs">{event.venueId ?? "—"}</td>
                    </tr>
                    {expandedId === event.id && (
                      <tr className="border-b bg-muted/30">
                        <td colSpan={6} className="p-4">
                          <div className="space-y-3 text-sm">
                            <div>
                              <span className="font-medium text-muted-foreground">Subject (derived):</span>{" "}
                              {event.subject}
                            </div>
                            {event.sentAt && (
                              <div>
                                <span className="font-medium text-muted-foreground">Sent at:</span>{" "}
                                {new Date(event.sentAt).toLocaleString()}
                              </div>
                            )}
                            {event.status === "FAILED" && event.error && (
                              <div>
                                <span className="font-medium text-red-600 dark:text-red-400">Error:</span>
                                <pre className="mt-1 overflow-x-auto rounded bg-red-50 p-2 text-red-800 dark:bg-red-900/20 dark:text-red-300">
                                  {event.error}
                                </pre>
                              </div>
                            )}
                            <div>
                              <span className="font-medium text-muted-foreground">Payload:</span>
                              <pre className="mt-1 max-h-48 overflow-auto rounded border bg-background p-2 font-mono text-xs">
                                {formatPayload(event.payload)}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
