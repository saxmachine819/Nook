import * as React from "react"
import { cn } from "@/lib/utils"

interface LoadingSpinnerProps {
  size?: "sm" | "md"
  className?: string
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
}

export function LoadingSpinner({ size = "sm", className }: LoadingSpinnerProps) {
  return (
    <svg
      className={cn("animate-spin text-primary", sizeClasses[size], className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="32 100"
      />
    </svg>
  )
}
