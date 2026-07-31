import { redirect } from "next/navigation"
import dynamic from "next/dynamic"
import { headers, cookies } from "next/headers"
import { lookupQRAssetByToken } from "@/lib/qr-asset-utils"
import { recordQRScanEvent } from "@/lib/qr-events"
import { canRegisterQR, canEditVenue, isAdmin } from "@/lib/venue-auth"
import { auth } from "@/lib/auth"
import { InvalidQRCodePage } from "@/components/qr/InvalidQRCodePage"
import { UnregisteredQRPage } from "@/components/qr/UnregisteredQRPage"
import { RetiredQRPage } from "@/components/qr/RetiredQRPage"
import { QRPlaceholderPage } from "@/components/qr/QRPlaceholderPage"

const QRRedirectWithAdminPanel = dynamic(
  () =>
    import("@/components/qr/QRRedirectWithAdminPanel")
      .then((mod) => ({
        default: mod?.QRRedirectWithAdminPanel ?? (() => null),
      }))
      .catch(() => ({ default: () => null })),
  { ssr: false }
)

// QR flow: token → lookup; ACTIVE + venueId → redirect to /venue/[id] (optional resource params); scan recorded in QREvent.

interface QRScanPageProps {
  params: Promise<{ token: string }>
}

export default async function QRScanPage({ params }: QRScanPageProps) {
  const { token } = await params
  const headersList = await headers()
  const cookieStore = await cookies()
  const session = await auth()
  const userAgent = headersList.get("user-agent") ?? null
  const sessionId =
    cookieStore.get("next-auth.session-token")?.value ??
    cookieStore.get("__Secure-next-auth.session-token")?.value ??
    null

  // Look up QR asset by token
  let qrAsset: Awaited<ReturnType<typeof lookupQRAssetByToken>>
  try {
    qrAsset = await lookupQRAssetByToken(token)
  } catch (error) {
    console.error("Error looking up QR asset:", error)
    await recordQRScanEvent({
      token,
      eventType: "scan",
      userId: session?.user?.id ?? null,
      sessionId,
      userAgent,
    })
    return <InvalidQRCodePage />
  }

  // If QR asset not found, show invalid page
  if (!qrAsset) {
    await recordQRScanEvent({
      token,
      eventType: "scan",
      userId: session?.user?.id ?? null,
      sessionId,
      userAgent,
    })
    return <InvalidQRCodePage />
  }

  // Record scan event once per page load (token resolved)
  await recordQRScanEvent({
    token,
    qrAssetId: qrAsset.id,
    eventType: "scan",
    venueId: qrAsset.status === "ACTIVE" ? (qrAsset.venueId ?? null) : null,
    resourceType: qrAsset.status === "ACTIVE" ? (qrAsset.resourceType ?? null) : null,
    resourceId: qrAsset.status === "ACTIVE" ? (qrAsset.resourceId ?? null) : null,
    userId: session?.user?.id ?? null,
    sessionId,
    userAgent,
  })

  // Handle different statuses
  switch (qrAsset.status) {
    case "UNREGISTERED": {
      // Check if user can register QR codes
      const userCanRegister = session?.user?.id
        ? await canRegisterQR({ id: session.user.id, email: session.user.email })
        : false

      return <UnregisteredQRPage token={token} canRegister={userCanRegister} />
    }

    case "ACTIVE": {
      // Check if user is venue admin for this QR's venue
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
        
        // Add resource preselection params if available (seat/table QR)
        if (qrAsset.resourceType && qrAsset.resourceId) {
          queryParams.set("resourceType", qrAsset.resourceType)
          queryParams.set("resourceId", qrAsset.resourceId)
        } else {
          // Venue-level QR (register/front window): no resource preselection; tag source for analytics
          queryParams.set("source", "qr")
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
