"use client"

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

interface Venue {
  id: string
  name: string
  address: string
  thumbnail: string | null
}

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const router = useRouter()
  const callbackUrl = searchParams.get("callbackUrl")
  const [venues, setVenues] = useState<Venue[]>([])
  const [loadingVenues, setLoadingVenues] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
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

  // Fetch venues when authenticated
  useEffect(() => {
    if (!session?.user?.id) {
      setLoadingVenues(false)
      return
    }
    fetch("/api/users/me/venues")
      .then((r) => (r.ok ? r.json() : { venues: [], isAdmin: false }))
      .then((data) => {
        setVenues(data.venues ?? [])
        setIsAdmin(data.isAdmin ?? false)
      })
      .catch(() => {
        setVenues([])
        setIsAdmin(false)
      })
      .finally(() => {
        setLoadingVenues(false)
      })
  }, [session?.user?.id])

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
      // Use relative URL to avoid port mismatch issues
      const redirectUrl = callbackUrl || "/"
      // Ensure callbackUrl is relative (not absolute) so it uses current origin
      const relativeCallbackUrl = redirectUrl.startsWith("http") 
        ? new URL(redirectUrl).pathname + new URL(redirectUrl).search
        : redirectUrl
      signIn("google", { callbackUrl: relativeCallbackUrl })
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
          <CardContent className="space-y-3">
            <Button
              onClick={() => signOut()}
              variant="outline"
              className="w-full"
              size="lg"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
            <Button
              variant="outline"
              className="w-full text-muted-foreground hover:text-foreground"
              size="lg"
              onClick={() => {
                setDeleteModalOpen(true)
                setDeleteError(null)
                setDeleteConfirmation("")
                setDeleteReason("")
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete account
            </Button>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Admin</CardTitle>
              <CardDescription>
                Access the admin panel to manage approvals, venues, and users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="lg" asChild className="w-full">
                <Link href="/admin">
                  <Shield className="mr-2 h-4 w-4" />
                  Go to Admin Panel
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>My Venues</CardTitle>
            <CardDescription>
              {loadingVenues
                ? "Loading..."
                : venues.length === 0
                  ? "List your venue on Nooc"
                  : "Manage your venues from the dashboard"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingVenues ? (
              <p className="text-sm text-muted-foreground">Loading venues…</p>
            ) : venues.length === 0 ? (
              <>
                <p className="mb-4 text-sm text-muted-foreground">
                  If you manage a café or hotel lobby with workspace seating, you can request to be added to Nooc.
                </p>
                <Button size="lg" asChild className="w-full">
                  <Link href="/venue/onboard">
                    <Plus className="mr-2 h-4 w-4" />
                    Add your venue
                  </Link>
                </Button>
              </>
            ) : (
              <Button size="lg" variant="outline" asChild className="w-full">
                <Link href="/venue/dashboard">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Open Venue Dashboard
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
            <DialogDescription>
              This will anonymize your account, pause your venues, and cancel your future reservations. Type DELETE to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="delete-confirmation">Type DELETE to confirm</Label>
              <Input
                id="delete-confirmation"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="DELETE"
                className="font-mono"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="delete-reason">Reason (optional)</Label>
              <Textarea
                id="delete-reason"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Optional feedback"
                rows={2}
              />
            </div>
            {deleteError && (
              <p className="text-sm text-destructive">{deleteError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteLoading || deleteConfirmation !== "DELETE"}
            >
              {deleteLoading ? "Deleting…" : "Delete my account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
