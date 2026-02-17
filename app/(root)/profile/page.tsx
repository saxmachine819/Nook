"use client"

import React, { Suspense } from "react"
import { useSession, signIn, signOut } from "next-auth/react"
import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { User, LogOut, LogIn, LayoutDashboard, Plus, Shield, Trash2 } from "lucide-react"

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

import { useMe, useMyVenuesCount } from "@/lib/hooks"

function ProfileContent() {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const router = useRouter()
  const callbackUrl = searchParams?.get("callbackUrl")

  const { data: userData, isLoading: loadingUser } = useMe(status === "authenticated")
  const { data: venueData, isLoading: loadingVenues } = useMyVenuesCount(status === "authenticated")

  const isAdmin = userData?.isAdmin ?? false
  const venueCount = venueData?.count ?? 0

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [deleteReason, setDeleteReason] = useState("")
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Redirect to callbackUrl after successful sign-in (defer to avoid setState-during-render)
  useEffect(() => {
    if (!session || !callbackUrl) return
    const t = setTimeout(() => {
      router.replace(callbackUrl)
    }, 0)
    return () => clearTimeout(t)
  }, [session, callbackUrl, router])

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") {
      setDeleteError("Type DELETE to confirm.")
      return
    }
    setDeleteError(null)
    setDeleteLoading(true)
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmation: "DELETE",
          reason: deleteReason.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setDeleteError(data.error || "Failed to delete account.")
        return
      }
      await signOut({ redirect: false })
      router.push("/account-deleted")
    } catch {
      setDeleteError("Something went wrong. Please try again.")
    } finally {
      setDeleteLoading(false)
    }
  }

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
      const relativeCallbackUrl = redirectUrl.startsWith("http")
        ? new URL(redirectUrl).pathname + new URL(redirectUrl).search
        : redirectUrl
      signIn("google", { callbackUrl: relativeCallbackUrl })
    }

    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16 max-w-xl">
          <div className="flex flex-col items-center text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex h-24 w-24 items-center justify-center rounded-[2.5rem] bg-white shadow-lg ring-1 ring-black/5">
              <User className="h-10 w-10 text-primary/40" />
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl font-black tracking-tight">Your Space</h1>
              <p className="text-sm font-medium text-muted-foreground/70 max-w-[280px] mx-auto leading-relaxed">
                Sign in to manage your bookings, discover exclusive workspace deals, and more.
              </p>
            </div>

            <Card className="w-full border-none bg-white shadow-lg rounded-[2.5rem] p-8">
              <CardContent className="p-0 space-y-6">
                <Button onClick={handleSignIn} size="lg" className="w-full h-14 rounded-2xl font-black text-lg shadow-md shadow-primary/10">
                  <LogIn className="mr-3 h-5 w-5" />
                  Continue with Google
                </Button>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">
                  By continuing, you agree to our Terms and Privacy Policy.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-12 flex items-center gap-6 px-1 animate-in fade-in duration-700">
          <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-[2rem] bg-white shadow-lg ring-1 ring-black/5">
            <div className="flex h-full w-full items-center justify-center text-xl font-black text-primary/40">
              {initialsFromName(session.user?.name) ? (
                initialsFromName(session.user?.name)
              ) : (
                <User className="h-8 w-8" />
              )}
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tight text-foreground/90">
              {session.user?.name || "Member"}
            </h1>
            <p className="text-sm font-bold text-muted-foreground/60 uppercase tracking-widest">Account Settings</p>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <Card className="border-none bg-white shadow-lg rounded-[2.5rem] p-4">
            <CardHeader className="p-6">
              <CardTitle className="text-xl font-black tracking-tight">Profile Info</CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-6">
              <div className="p-4 bg-primary/[0.02] rounded-2xl border border-primary/5">
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Full Name</label>
                <p className="text-sm font-bold text-foreground/80">
                  {session.user?.name || "Not provided"}
                </p>
              </div>
              <div className="p-4 bg-primary/[0.02] rounded-2xl border border-primary/5">
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Email Address</label>
                <p className="text-sm font-bold text-foreground/80">
                  {session.user?.email || "Not provided"}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-8">
            <Card className="border-none bg-white shadow-lg rounded-[2.5rem] p-4">
              <CardHeader className="p-6">
                <CardTitle className="text-xl font-black tracking-tight">Security & Privacy</CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-0 space-y-3">
                <Button
                  onClick={() => signOut()}
                  variant="outline"
                  className="w-full h-12 rounded-2xl font-bold bg-primary/5 border-none text-primary hover:bg-primary/10 transition-all"
                >
                  <LogOut className="mr-2 h-4 w-4 opacity-50" />
                  Sign out
                </Button>
                <Button
                  variant="ghost"
                  className="w-full h-12 rounded-2xl font-bold text-muted-foreground/60 hover:text-red-600 hover:bg-red-50 transition-all"
                  onClick={() => {
                    setDeleteModalOpen(true)
                    setDeleteError(null)
                    setDeleteConfirmation("")
                    setDeleteReason("")
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4 opacity-30" />
                  Delete account
                </Button>
              </CardContent>
            </Card>

            {isAdmin && (
              <Card className="border-none bg-primary text-white shadow-lg rounded-[2.5rem] p-4">
                <CardHeader className="p-6">
                  <CardTitle className="text-xl font-black tracking-tight">Admin Portal</CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <Button size="lg" asChild className="w-full h-12 rounded-2xl font-black bg-white text-primary hover:bg-white/90">
                    <Link href="/admin">
                      <Shield className="mr-2 h-4 w-4" />
                      Manage Platform
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="border-none bg-white shadow-lg rounded-[2.5rem] p-4 lg:col-span-2">
            <CardHeader className="p-6">
              <CardTitle className="text-xl font-black tracking-tight">Venues Dashboard</CardTitle>
              <CardDescription className="text-sm font-medium text-muted-foreground/60">
                {loadingVenues
                  ? "Retrieving your spaces..."
                  : venueCount === 0
                    ? "Start sharing your venue with our community"
                    : `You are managing ${venueCount} space${venueCount > 1 ? 's' : ''}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              {loadingVenues ? (
                <div className="h-20 flex items-center justify-center">
                  <div className="h-6 w-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
              ) : venueCount === 0 ? (
                <div className="flex flex-col gap-6">
                  <p className="text-sm font-medium text-foreground/60 leading-relaxed max-w-lg">
                    Whether you manage a boutique café, a hotel lobby, or a creative studio, join Nooc to reach thousands of remote workers looking for their next favorite spot.
                  </p>
                  <Button size="lg" asChild className="w-full h-14 rounded-2xl font-black shadow-md shadow-primary/5">
                    <Link href="/venue/onboard">
                      <Plus className="mr-2 h-5 w-5" />
                      Add your workspace
                    </Link>
                  </Button>
                </div>
              ) : (
                <Button size="lg" variant="outline" asChild className="w-full h-14 rounded-2xl font-black bg-primary/5 border-none text-primary hover:bg-primary/10 transition-all">
                  <Link href="/venue/dashboard">
                    <LayoutDashboard className="mr-2 h-5 w-5" />
                    Open Management Dashboard
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
          <DialogContent className="rounded-[2.5rem] p-8 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight">Delete Account</DialogTitle>
              <DialogDescription className="text-sm font-medium text-muted-foreground pt-2">
                This will permanently delete your personal data. Any active venues will be paused and future bookings cancelled.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 my-6">
              <div className="space-y-3">
                <Label htmlFor="delete-confirmation" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Type DELETE to confirm</Label>
                <Input
                  id="delete-confirmation"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="DELETE"
                  className="h-12 rounded-xl font-bold border-none bg-primary/[0.03]"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="delete-reason" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Optional Feedback</Label>
                <Textarea
                  id="delete-reason"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Tell us how we can improve"
                  rows={2}
                  className="rounded-xl font-medium border-none bg-primary/[0.03]"
                />
              </div>
              {deleteError && (
                <p className="text-xs font-bold text-red-500">{deleteError}</p>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={deleteLoading || deleteConfirmation !== "DELETE"}
                className="rounded-2xl h-12 font-black shadow-md shadow-red-500/10"
              >
                {deleteLoading ? "Closing account..." : "Permanently Delete Account"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleteLoading}
                className="rounded-2xl h-12 font-bold text-muted-foreground"
              >
                Go Back
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <ProfileContent />
    </Suspense>
  )
}
