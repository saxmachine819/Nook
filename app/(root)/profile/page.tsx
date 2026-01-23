"use client"

import { useSession, signIn, signOut } from "next-auth/react"
import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { User, LogOut, LogIn, LayoutDashboard, Plus } from "lucide-react"

function initialsFromName(name?: string | null) {
  const trimmed = (name || "").trim()
  if (!trimmed) return ""
  return trimmed
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("")
}

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const router = useRouter()
  const callbackUrl = searchParams.get("callbackUrl")

  // Redirect to callbackUrl after successful sign-in (defer to avoid setState-during-render)
  useEffect(() => {
    if (!session || !callbackUrl) return
    const t = setTimeout(() => {
      router.replace(callbackUrl)
    }, 0)
    return () => clearTimeout(t)
  }, [session, callbackUrl, router])

  if (status === "loading") {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    const handleSignIn = () => {
      const redirectUrl = callbackUrl || "/"
      signIn("google", { callbackUrl: redirectUrl })
    }

    return (
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
            <p className="text-sm text-muted-foreground">Sign in to manage your account</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Sign in to reserve seats and manage your reservations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleSignIn}
              className="w-full"
              size="lg"
            >
              <LogIn className="mr-2 h-4 w-4" />
              Sign in with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6 flex items-center gap-4">
        <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-muted">
          <div className="flex h-full w-full items-center justify-center bg-muted text-sm font-medium text-muted-foreground">
            {initialsFromName(session.user?.name) ? (
              initialsFromName(session.user?.name)
            ) : (
              <User className="h-8 w-8" />
            )}
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
          <p className="text-sm text-muted-foreground">Your account settings</p>
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>
              Your personal details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-muted-foreground">Name</label>
                <p className="text-sm font-medium">
                  {session.user?.name || "Not provided"}
                </p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-muted-foreground">Email</label>
                <p className="text-sm font-medium">
                  {session.user?.email || "Not provided"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Actions</CardTitle>
            <CardDescription>
              Manage your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => signOut()}
              variant="outline"
              className="w-full"
              size="lg"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My Venues</CardTitle>
            <CardDescription>Manage your venues from the dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="lg" variant="outline" asChild className="w-full">
              <Link href="/venue/dashboard">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Open Venue Dashboard
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
