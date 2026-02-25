"use client"

import React, { useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/toast"

interface SettingsClientProps {
  initialSearchLandingEnabled: boolean
}

export function SettingsClient({ initialSearchLandingEnabled }: SettingsClientProps) {
  const [searchLandingEnabled, setSearchLandingEnabled] = useState(initialSearchLandingEnabled)
  const [isSaving, setIsSaving] = useState(false)
  const { showToast, ToastComponent } = useToast()

  const handleToggle = useCallback(async () => {
    const newValue = !searchLandingEnabled
    setIsSaving(true)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "search_landing_enabled", value: String(newValue) }),
      })

      if (!res.ok) {
        throw new Error("Failed to save")
      }

      setSearchLandingEnabled(newValue)
      showToast(
        newValue
          ? "Search Landing Page enabled — homepage now shows Search."
          : "Search Landing Page disabled — homepage now shows Explore Map.",
        "success"
      )
    } catch {
      showToast("Failed to update setting. Please try again.", "error")
    } finally {
      setIsSaving(false)
    }
  }, [searchLandingEnabled, showToast])

  return (
    <>
      {ToastComponent}
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Feature Flags</h1>
          <p className="text-sm text-muted-foreground">Control site-wide features</p>
        </div>

        <div className="max-w-2xl space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Search Landing Page</CardTitle>
              <CardDescription>
                When enabled, the Nooc homepage shows a Search Landing Page instead of the Explore Map.
                Users can still access the map via the &ldquo;View on map&rdquo; link.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Label htmlFor="search-landing-toggle" className="text-sm font-medium">
                    {searchLandingEnabled ? "Enabled" : "Disabled"}
                  </Label>
                  <div
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                      searchLandingEnabled ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                    role="switch"
                    aria-checked={searchLandingEnabled}
                    id="search-landing-toggle"
                    onClick={handleToggle}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleToggle() } }}
                    tabIndex={0}
                  >
                    <span
                      className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                        searchLandingEnabled ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </div>
                </div>
                {isSaving && (
                  <span className="text-xs text-muted-foreground">Saving...</span>
                )}
              </div>

              <div className="mt-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <p><strong>Flag OFF:</strong> Homepage (<code>/</code>) shows the Explore Map (current behavior).</p>
                <p className="mt-1"><strong>Flag ON:</strong> Homepage (<code>/</code>) redirects to the Search Landing Page (<code>/search</code>).</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
