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
  () => import("@/components/qr/QRRedirectWithAdminPanel").then((mod) => ({ default: mod.QRRedirectWithAdminPanel })),
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
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/b5111244-c4ed-4ea6-9398-28181fe79047", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "app/q/[token]/page.tsx:lookup", message: "QR lookup threw", data: { token: token?.slice(0, 8), err: String((error as Error)?.message) }, timestamp: Date.now(), sessionId: "debug-session", hypothesisId: "H4" }) }).catch(() => {})
    // #endregion
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
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/b5111244-c4ed-4ea6-9398-28181fe79047", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "app/q/[token]/page.tsx:notFound", message: "QR asset not found", data: { tokenPrefix: token?.slice(0, 8), tokenLength: token?.length ?? 0 }, timestamp: Date.now(), sessionId: "debug-session", hypothesisId: "H4" }) }).catch(() => {})
    // #endregion
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
      // #region agent log
      fetch("http://127.0.0.1:7242/ingest/b5111244-c4ed-4ea6-9398-28181fe79047", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "app/q/[token]/page.tsx:ACTIVE", message: "QR ACTIVE before redirect", data: { token: token?.slice(0, 8), status: qrAsset.status, venueId: qrAsset.venueId ?? null, resourceType: qrAsset.resourceType ?? null, resourceId: qrAsset.resourceId ?? null }, timestamp: Date.now(), sessionId: "debug-session", hypothesisId: "H1_H5" }) }).catch(() => {})
      // #endregion

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

        // #region agent log
        fetch("http://127.0.0.1:7242/ingest/b5111244-c4ed-4ea6-9398-28181fe79047", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "app/q/[token]/page.tsx:redirectUrl", message: "Redirect URL built", data: { redirectUrl, hasResourceParams: !!(qrAsset.resourceType && qrAsset.resourceId), resourceType: qrAsset.resourceType ?? null, resourceId: qrAsset.resourceId ?? null }, timestamp: Date.now(), sessionId: "debug-session", hypothesisId: "H1" }) }).catch(() => {})
        // #endregion

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
