import { LoadingSpinner } from "@/components/ui/loading-spinner"

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <LoadingSpinner size="md" />
    </div>
  )
}
