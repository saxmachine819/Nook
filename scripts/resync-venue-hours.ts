/**
 * Resync venue hours: backfill from existing openingHoursJson or re-fetch from Google Place Details.
 * Respects hoursSource === "manual" (never overwrites manual rows).
 *
 * Usage:
 *   npx tsx scripts/resync-venue-hours.ts --from-json [--dry-run] [--venue-id=...]
 *   npx tsx scripts/resync-venue-hours.ts --from-google [--dry-run] [--venue-id=...]
 */

import { Prisma } from "@prisma/client"
import { prisma } from "../lib/prisma"
import {
  parseGooglePeriodsToVenueHours,
  syncVenueHoursFromGoogle,
} from "../lib/venue-hours"

const PLACES_API_BASE = "https://places.googleapis.com/v1"

interface PlaceDetailsOpeningHours {
  periods?: Array<{
    open: { day: number; hour: number; minute: number }
    close?: { day: number; hour: number; minute: number }
  }>
}

function parseArgs(): {
  fromJson: boolean
  fromGoogle: boolean
  dryRun: boolean
  venueId: string | null
} {
  const args = process.argv.slice(2)
  let fromJson = false
  let fromGoogle = false
  let dryRun = false
  let venueId: string | null = null
  for (const a of args) {
    if (a === "--from-json") fromJson = true
    else if (a === "--from-google") fromGoogle = true
    else if (a === "--dry-run") dryRun = true
    else if (a.startsWith("--venue-id=")) venueId = a.slice("--venue-id=".length).trim() || null
  }
  return { fromJson, fromGoogle, dryRun, venueId }
}

function hasPeriods(obj: unknown): obj is { periods: unknown[] } {
  return (
    obj != null &&
    typeof obj === "object" &&
    "periods" in obj &&
    Array.isArray((obj as { periods?: unknown[] }).periods) &&
    (obj as { periods: unknown[] }).periods.length > 0
  )
}

async function fetchPlaceDetailsOpeningHours(
  placeId: string
): Promise<PlaceDetailsOpeningHours | null> {
  const apiKey =
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    throw new Error(
      "GOOGLE_PLACES_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set"
    )
  }
  const placeIdFormatted = placeId.startsWith("places/")
    ? placeId
    : `places/${placeId}`
  const fieldMask = ["regularOpeningHours"].join(",")
  const res = await fetch(`${PLACES_API_BASE}/${placeIdFormatted}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Place Details ${res.status}: ${text}`)
  }
  const data = (await res.json()) as { regularOpeningHours?: PlaceDetailsOpeningHours }
  return data.regularOpeningHours ?? null
}

async function runFromJson(dryRun: boolean, venueIdFilter: string | null) {
  const venues = await prisma.venue.findMany({
    where: {
      ...(venueIdFilter ? { id: venueIdFilter } : {}),
      openingHoursJson: { not: Prisma.JsonNull },
    },
    select: {
      id: true,
      name: true,
      openingHoursJson: true,
      hoursSource: true,
    },
  })

  const withPeriods = venues.filter((v) => hasPeriods(v.openingHoursJson))
  console.log(
    `[from-json] Venues with openingHoursJson.periods: ${withPeriods.length} (of ${venues.length} with non-null openingHoursJson)`
  )
  if (venueIdFilter && withPeriods.length === 0) {
    console.log(`[from-json] No venue found or openingHoursJson has no periods.`)
    return
  }

  let ok = 0
  let err = 0
  for (const venue of withPeriods) {
    const openingHours = venue.openingHoursJson as { periods: PlaceDetailsOpeningHours["periods"] }
    const periods = openingHours.periods ?? []
    try {
      const hoursData = parseGooglePeriodsToVenueHours(
        periods as Parameters<typeof parseGooglePeriodsToVenueHours>[0],
        venue.id,
        "google"
      )
      if (dryRun) {
        console.log(
          `[dry-run] Would sync VenueHours for ${venue.name} (${venue.id}), ${hoursData.length} rows`
        )
        ok++
        continue
      }
      await syncVenueHoursFromGoogle(
        prisma,
        venue.id,
        hoursData,
        venue.hoursSource ?? null
      )
      console.log(`[ok] ${venue.name} (${venue.id}) – synced ${hoursData.length} rows`)
      ok++
    } catch (e) {
      console.error(`[error] ${venue.name} (${venue.id}):`, e)
      err++
    }
  }
  console.log(`[from-json] Done: ${ok} ok, ${err} errors`)
}

async function runFromGoogle(
  dryRun: boolean,
  venueIdFilter: string | null
) {
  const venues = await prisma.venue.findMany({
    where: {
      ...(venueIdFilter ? { id: venueIdFilter } : {}),
      googlePlaceId: { not: null },
      NOT: { hoursSource: "manual" },
    },
    select: {
      id: true,
      name: true,
      googlePlaceId: true,
      hoursSource: true,
    },
  })

  const list = venues.filter((v) => v.googlePlaceId != null) as Array<{
    id: string
    name: string
    googlePlaceId: string
    hoursSource: string | null
  }>
  console.log(
    `[from-google] Venues with googlePlaceId (non-manual): ${list.length}`
  )
  if (list.length === 0) {
    console.log(`[from-google] Nothing to do.`)
    return
  }

  let ok = 0
  let err = 0
  for (let i = 0; i < list.length; i++) {
    const venue = list[i]
    if (i > 0) {
      await new Promise((r) => setTimeout(r, 1100))
    }
    try {
      if (dryRun) {
        console.log(
          `[dry-run] Would fetch Place Details and update VenueHours for ${venue.name} (${venue.id})`
        )
        ok++
        continue
      }
      const openingHours = await fetchPlaceDetailsOpeningHours(venue.googlePlaceId)
      if (!openingHours?.periods?.length) {
        console.log(
          `[skip] ${venue.name} (${venue.id}) – no periods from Google`
        )
        continue
      }
      const hoursData = parseGooglePeriodsToVenueHours(
        openingHours.periods as Parameters<typeof parseGooglePeriodsToVenueHours>[0],
        venue.id,
        "google"
      )
      await prisma.venue.update({
        where: { id: venue.id },
        data: {
          openingHoursJson: openingHours as object,
          hoursSource: "google",
          hoursUpdatedAt: new Date(),
        },
      })
      await syncVenueHoursFromGoogle(prisma, venue.id, hoursData, "google")
      console.log(
        `[ok] ${venue.name} (${venue.id}) – updated openingHoursJson and ${hoursData.length} VenueHours`
      )
      ok++
    } catch (e) {
      console.error(`[error] ${venue.name} (${venue.id}):`, e)
      err++
    }
  }
  console.log(`[from-google] Done: ${ok} ok, ${err} errors`)
}

async function main() {
  const { fromJson, fromGoogle, dryRun, venueId } = parseArgs()
  if (!fromJson && !fromGoogle) {
    console.log(
      "Usage: npx tsx scripts/resync-venue-hours.ts --from-json|--from-google [--dry-run] [--venue-id=...]"
    )
    process.exit(1)
  }
  if (fromJson && fromGoogle) {
    console.log("Use either --from-json or --from-google, not both.")
    process.exit(1)
  }
  if (dryRun) console.log("DRY RUN – no writes will be performed.")
  if (venueId) console.log("Filtering to venue-id:", venueId)

  try {
    if (fromJson) await runFromJson(dryRun, venueId)
    else await runFromGoogle(dryRun, venueId)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
