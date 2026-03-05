"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { Download, Loader2 } from "lucide-react"

interface ManufacturingPackCardProps {
  batchId: string
}

export function ManufacturingPackCard({ batchId }: ManufacturingPackCardProps) {
  const { showToast, ToastComponent } = useToast()
  const [generating, setGenerating] = useState(false)

  const generateUrl = `/api/admin/qr-assets/batch/${encodeURIComponent(batchId)}/manufacturing-pack/generate`
  const downloadUrl = `/api/admin/qr-assets/batch/${encodeURIComponent(batchId)}/manufacturing-pack`

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch(generateUrl, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || "Failed to generate", "error")
        return
      }
      const { generated, skipped, total } = data
      showToast(
        `Generated ${generated} PNGs, skipped ${skipped} (${total} total). You can download the pack below.`,
        "success"
      )
    } catch {
      showToast("Failed to generate manufacturing assets", "error")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manufacturing pack</CardTitle>
          <CardDescription>
            Plain black-and-white PNG files (one per token) for your manufacturer. Each file is labeled (e.g. batch label + index). Generate once, then download the ZIP anytime.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              "Generate manufacturing assets"
            )}
          </Button>
          <Button variant="outline" asChild>
            <a href={downloadUrl} download={`manufacturing-pack-${batchId}.zip`}>
              <Download className="mr-2 h-4 w-4" />
              Download manufacturing pack (ZIP)
            </a>
          </Button>
        </CardContent>
      </Card>
      {ToastComponent}
    </>
  )
}
