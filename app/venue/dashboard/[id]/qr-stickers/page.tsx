import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditVenue } from "@/lib/venue-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import Link from "next/link"

interface QRStickersPageProps {
  params: Promise<{ id: string }>
}

export default async function QRStickersPage({ params }: QRStickersPageProps) {
  const session = await auth()
  if (!session?.user?.id) {
    notFound()
  }

  const { id } = await params

  const venue = await prisma.venue.findUnique({
    where: { id },
    select: { id: true, name: true, ownerId: true },
  })

  if (!venue || !canEditVenue(session.user, venue)) {
    notFound()
  }

  // Fetch QR assets for this venue
  const qrAssets = await prisma.qRAsset.findMany({
    where: { venueId: venue.id },
    select: {
      id: true,
      token: true,
      status: true,
      resourceType: true,
      resourceId: true,
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <Link href={`/venue/dashboard/${venue.id}`} className="text-sm text-muted-foreground hover:underline">
          ← Back to dashboard
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-2">QR Code Stickers</h1>
        <p className="text-sm text-muted-foreground mt-1">{venue.name}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Download Stickers</CardTitle>
        </CardHeader>
        <CardContent>
          {qrAssets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No QR codes assigned to this venue yet.</p>
          ) : (
            <div className="space-y-2">
              {qrAssets.map((asset) => (
                <div key={asset.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <p className="font-medium text-sm">Token: {asset.token}</p>
                    <p className="text-xs text-muted-foreground">
                      {asset.resourceType || "unassigned"} {asset.resourceId || ""} • {asset.status}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <a href={`/api/qr-assets/${asset.token}/sticker.svg`} download={`nooc-sticker-${asset.token}.svg`}>
                      <Download className="mr-2 h-4 w-4" />
                      Download SVG
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
