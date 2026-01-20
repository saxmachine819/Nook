"use client"

import { useEffect, useState } from "react"
import { X, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ToastProps {
  message: string
  type?: "success" | "error"
  onClose: () => void
  duration?: number
}

export function Toast({ message, type = "success", onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  return (
    <div
      className={cn(
        "fixed top-4 left-1/2 z-50 flex -translate-x-1/2 transform items-center gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg transition-all",
        type === "success" && "border-green-200 bg-green-50 text-green-900",
        type === "error" && "border-red-200 bg-red-50 text-red-900"
      )}
    >
      {type === "success" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
      <p className="text-sm font-medium">{message}</p>
      <button
        onClick={onClose}
        className="ml-2 rounded-md p-1 hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function useToast() {
  const [toast, setToast] = useState<{ message: string; type?: "success" | "error" } | null>(null)

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type })
  }

  const ToastComponent = toast ? (
    <Toast
      message={toast.message}
      type={toast.type}
      onClose={() => setToast(null)}
    />
  ) : null

  return { showToast, ToastComponent }
}