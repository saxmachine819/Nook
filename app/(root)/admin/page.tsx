import React from "react"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/venue-auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { CheckCircle2, Building2, Users } from "lucide-react"

export default async function AdminPage() {
  const session = await auth()

  // Check if user is authenticated and is an admin
  if (!session?.user || !isAdmin(session.user)) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Not authorized</CardTitle>
              <CardDescription>
                You do not have permission to access this page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/">Go to Home</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Admin landing page
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Admin Panel</h1>
        <p className="text-sm text-muted-foreground">Manage approvals, venues, and users</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="transition-colors hover:bg-accent/50">
          <Link href="/admin/approvals" className="block">
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <CardTitle>Approvals</CardTitle>
              <CardDescription>
                Review and approve venue submissions
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>

        <Card className="transition-colors hover:bg-accent/50">
          <Link href="/admin/venues" className="block">
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <CardTitle>Venues</CardTitle>
              <CardDescription>
                Manage all venues in the system
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>

        <Card className="transition-colors hover:bg-accent/50">
          <Link href="/admin/users" className="block">
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <CardTitle>Users</CardTitle>
              <CardDescription>
                View and manage user accounts
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>
      </div>
    </div>
  )
}
