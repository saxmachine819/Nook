"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import Link from "next/link"

function ErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams?.get("error")
  const errorDescription = searchParams?.get("error_description")

  const errorMessages: Record<string, string> = {
    Configuration: "There is a problem with the server configuration. Check if your options are correct.",
    AccessDenied: "You do not have permission to sign in.",
    Verification: "The verification token has expired or has already been used.",
    Default: "An error occurred during authentication.",
  }

  const errorMessage = errorMessages[error || ""] || errorMessages.Default || errorDescription || "An error occurred during authentication."

  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <CardTitle>Authentication Error</CardTitle>
          </div>
          <CardDescription>
            {errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-muted p-3 space-y-2">
            {error && (
              <p className="text-xs font-mono text-muted-foreground">
                Error code: {error}
              </p>
            )}
            {errorDescription && (
              <p className="text-xs font-mono text-muted-foreground">
                Description: {errorDescription}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Full URL params: {searchParams?.toString() || "none"}
            </p>
          </div>
          <div className="space-y-2">
            <Button asChild className="w-full">
              <Link href="/profile">Try again</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">Go to Explore</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-12">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  )
}
