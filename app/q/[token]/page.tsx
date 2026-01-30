import { redirect } from "next/navigation"
import dynamic from "next/dynamic"
import { lookupQRAssetByToken } from "@/lib/qr-asset-utils"
import { canRegisterQR, canEditVenue, isAdmin } from "@/lib/venue-auth"
import { auth } from "@/lib/auth"
import { InvalidQRCodePage } from "@/components/qr/InvalidQRCodePage"
import { UnregisteredQRPage } from "@/components/qr/UnregisteredQRPage"
import { RetiredQRPage } from "@/components/qr/RetiredQRPage"
import { QRPlaceholderPage } from "@/components/qr/QRPlaceholderPage"

const QRRedirectWithAdminPanel = dynamic(
  () => import("@/components/qr/QRRedirectWithAdminPanel").then((mod) => ({ default: mod.QRRedirectWithAdminPanel })),
  { ssr: false }
)

interface QRScanPageProps {
  params: Promise<{ token: string }>
}

export default async function QRScanPage({ params }: QRScanPageProps) {
  const { token } = await params

  // Look up QR asset by token
  let qrAsset
  try {
    qrAsset = await lookupQRAssetByToken(token)
  } catch (error) {
    console.error("Error looking up QR asset:", error)
    return <InvalidQRCodePage />
  }

  // If QR asset not found, show invalid page
  if (!qrAsset) {
    return <InvalidQRCodePage />
  }

  // Handle different statuses
  switch (qrAsset.status) {
    case "UNREGISTERED": {
      // Check if user can register QR codes
      const session = await auth()
      const userCanRegister = session?.user?.id
        ? await canRegisterQR({ id: session.user.id, email: session.user.email })
        : false

      return <UnregisteredQRPage token={token} canRegister={userCanRegister} />
    }

    case "ACTIVE": {
      // TODO: Create qr_events table for proper scan event tracking
      console.log(
        `[QR Scan] token=${token}, status=${qrAsset.status}, venueId=${qrAsset.venueId || "null"}, resourceType=${qrAsset.resourceType || "null"}, resourceId=${qrAsset.resourceId || "null"}, timestamp=${new Date().toISOString()}`
      )

      // Check if user is venue admin for this QR's venue
      const session = await auth()
      let showAdminPanel = false
      
      if (session?.user?.id && qrAsset.venueId && qrAsset.venue) {
        // Check if user manages this venue
        showAdminPanel =
          isAdmin(session.user) ||
          canEditVenue(session.user, { ownerId: qrAsset.venue.ownerId })
      }

      // If venueId exists, redirect to venue page (with admin panel if applicable)
      if (qrAsset.venueId) {
        const queryParams = new URLSearchParams()
        
        // Add resource preselection params if available
        if (qrAsset.resourceType && qrAsset.resourceId) {
          queryParams.set("resourceType", qrAsset.resourceType)
          queryParams.set("resourceId", qrAsset.resourceId)
        }

        const queryString = queryParams.toString()
        const redirectUrl = queryString
          ? `/venue/${qrAsset.venueId}?${queryString}`
          : `/venue/${qrAsset.venueId}`

        // If user is venue admin, show admin panel before redirect
        if (showAdminPanel) {
          return (
            <QRRedirectWithAdminPanel
              token={token}
              venueId={qrAsset.venueId}
              resourceType={qrAsset.resourceType || null}
              resourceId={qrAsset.resourceId || null}
              redirectUrl={redirectUrl}
              delaySeconds={3}
            />
          )
        }

        // Normal redirect for non-admins (must be last, can't return after redirect)
        redirect(redirectUrl)
      }

      // If no venueId, show placeholder page with assignment info
      return (
        <QRPlaceholderPage
          venueName={qrAsset.venue?.name || null}
          resourceType={qrAsset.resourceType || null}
          resourceId={qrAsset.resourceId || null}
        />
      )
    }

    case "RETIRED": {
      return <RetiredQRPage />
    }

    default: {
      // Unknown status, treat as invalid
      return <InvalidQRCodePage />
    }
  }
}
