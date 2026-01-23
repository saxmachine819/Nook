import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { VenueDashboardClient } from "./VenueDashboardClient"

export default async function VenueDashboardPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/profile?callbackUrl=/venue/dashboard")
  }

  return <VenueDashboardClient />
}
