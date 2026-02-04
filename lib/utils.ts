import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** True when Blob is available as a constructor (needed for Mapbox and calendar download). */
export function isBlobSupported(): boolean {
  return typeof Blob === "function"
}