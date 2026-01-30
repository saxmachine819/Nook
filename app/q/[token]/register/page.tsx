import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canRegisterQR, isAdmin } from "@/lib/venue-auth"
import { lookupQRAssetByToken } from "@/lib/qr-asset-utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { QRRegistrationForm } from "@/components/qr/QRRegistrationForm"
import { InvalidQRCodePage } from "@/components/qr/InvalidQRCodePage"
import { Settings } from "lucide-react"

interface QRRegisterPageProps {
  params: Promise<{ token: string }>
  searchParams: Promise<{ venueId?: string; resourceType?: string; resourceId?: string }>
}

export default async function QRRegisterPage({ params, searchParams }: QRRegisterPageProps) {
  const { token } = await params
  const searchParamsResolved = await searchParams
  const prefilledVenueId = searchParamsResolved.venueId || null
  const prefilledResourceType = searchParamsResolved.resourceType || null
  const prefilledResourceId = searchParamsResolved.resourceId || null

  // Require authentication
  const session = await auth()
  if (!session?.user?.id) {
    redirect(`/profile?callbackUrl=${encodeURIComponent(`/q/${token}/register`)}`)
  }

  // Check if user has permission to register QR codes
  const userCanRegister = await canRegisterQR({
    id: session.user.id,
    email: session.user.email,
  })

  if (!userCanRegister) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Permission Denied</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                You must own at least one venue or be an admin to register QR codes.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Look up QR asset
  let qrAsset
  try {
    qrAsset = await lookupQRAssetByToken(token)
  } catch (error) {
    console.error("Error looking up QR asset:", error)
    return <InvalidQRCodePage />
  }

  // Verify QR asset exists
  if (!qrAsset) {
    return <InvalidQRCodePage />
  }

  // Verify QR asset is UNREGISTERED or ACTIVE (allow reassignment)
  if (qrAsset.status !== "UNREGISTERED" && qrAsset.status !== "ACTIVE") {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>QR Code Cannot Be Assigned</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                This QR code cannot be assigned (status: {qrAsset.status}).
                Only unregistered or active QR codes can be assigned.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Fetch user's venues
  const admin = isAdmin(session.user)
  const venues = await prisma.venue.findMany({
    where: admin ? undefined : { ownerId: session.user.id },
    select: {
      id: true,
      name: true,
      address: true,
    },
    orderBy: {
      name: "asc",
    },
  })

  if (venues.length === 0) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>No Venues Found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                You need to own at least one venue to register QR codes. Please create a venue first.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Auto-select venue: prefer prefilled, then single venue, then null
  const initialVenueId =
    prefilledVenueId ||
    (venues.length === 1 ? venues[0].id : null)

  // Verify prefilled venueId is valid (user manages it)
  let validPrefilledVenueId = null
  if (prefilledVenueId) {
    const prefilledVenue = venues.find((v) => v.id === prefilledVenueId)
    if (prefilledVenue) {
      validPrefilledVenueId = prefilledVenueId
    }
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              <CardTitle>
                {qrAsset.status === "ACTIVE" ? "Reassign QR Code" : "Register QR Code"}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-6 text-sm text-muted-foreground">
              {qrAsset.status === "ACTIVE"
                ? "Reassign this QR code to a different venue or resource."
                : "Assign this QR code to a venue and resource. Once assigned, scanning the QR code will redirect users to book that specific resource."}
            </p>
            <QRRegistrationForm
              token={token}
              venues={venues}
              initialVenueId={validPrefilledVenueId || initialVenueId}
              initialResourceType={prefilledResourceType}
              initialResourceId={prefilledResourceId}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
