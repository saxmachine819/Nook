import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/venue-auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface BatchPrintPageProps {
  params: Promise<{ batchId: string }>
  searchParams: Promise<{ limit?: string }>
}

export default async function BatchPrintPage({ params, searchParams }: BatchPrintPageProps) {
  const session = await auth()

  if (!session?.user || !isAdmin(session.user)) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Not authorized</CardTitle>
              <CardDescription>You do not have permission to access this page.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/admin">Go to Admin</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const { batchId } = await params
  const sp = await searchParams
  const limit = sp.limit ? Number.parseInt(sp.limit, 10) : 24
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 120) : 24

  const total = await prisma.qRAsset.count({
    where: { batchId },
  })

  const pdfHref = `/api/admin/qr-assets/batch/${encodeURIComponent(batchId)}/print.pdf?limit=${safeLimit}`

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">QR Batch Print</h1>
            <p className="text-sm text-muted-foreground">
              Batch: <span className="font-mono">{batchId}</span>
            </p>
            <p className="text-sm text-muted-foreground">Assets in batch: {total}</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin">Back to Admin</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Download PDF</CardTitle>
          <CardDescription>
            Generates an A4 grid of sticker designs for this batch (max 120 per request).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Current limit: <span className="font-mono">{safeLimit}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a href={pdfHref} target="_blank" rel="noreferrer">
                Open PDF
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={pdfHref} download>
                Download PDF
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Tip: adjust limit with <span className="font-mono">?limit=30</span> on this page URL.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

