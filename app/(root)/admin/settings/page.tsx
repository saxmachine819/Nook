import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/venue-auth"
import { isSearchLandingEnabled } from "@/lib/site-settings"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { SettingsClient } from "./SettingsClient"

export default async function AdminSettingsPage() {
  const session = await auth()

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

  const searchLandingEnabled = await isSearchLandingEnabled()

  return <SettingsClient initialSearchLandingEnabled={searchLandingEnabled} />
}
