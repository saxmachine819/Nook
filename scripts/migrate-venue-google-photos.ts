/**
 * Backfill existing venues: persist Google Places media URLs to Supabase, then
 * normalize all venue photos (dedupe, canonical hero). Fixes duplicates from
 * initial migration. Manual run only. Concurrency: 2.
 *
 * Usage:
 *   npx tsx scripts/migrate-venue-google-photos.ts
 */

import { Prisma } from "@prisma/client"
import { prisma } from "../lib/prisma"
import { persistVenuePhotos } from "../lib/persist-venue-photos"

const CONCURRENCY_LIMIT = 2
const GOOGLE_HOST = "places.googleapis.com"

function parseImageUrls(value: unknown): string[] {
  if (value == null) return []
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string" && v.length > 0)
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is string => typeof v === "string" && v.length > 0)
      }
    } catch {
      // ignore
    }
  }
  return []
}

function hasGoogleMediaUrl(venue: { heroImageUrl: string | null; imageUrls: unknown }): boolean {
  if (venue.heroImageUrl?.includes(GOOGLE_HOST)) return true
  const urls = parseImageUrls(venue.imageUrls)
  return urls.some((u) => u.includes(GOOGLE_HOST))
}

/** Build canonical list: hero first, then imageUrls without hero, deduped (order preserved). */
function normalizeHeroAndImageUrls(
  heroImageUrl: string | null,
  imageUrls: string[]
): { heroImageUrl: string | null; imageUrls: string[] } {
  const combined = [
    ...(heroImageUrl ? [heroImageUrl] : []),
    ...imageUrls.filter((u) => u !== heroImageUrl),
  ]
  const seen = new Set<string>()
  const deduped = combined.filter((u) => {
    if (seen.has(u)) return false
    seen.add(u)
    return true
  })
  const hero = deduped[0] ?? null
  const rest = deduped.length > 1 ? deduped.slice(1) : []
  return { heroImageUrl: hero, imageUrls: rest }
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((v, i) => v === b[i])
}

async function runWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let index = 0
  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++
      results[i] = await fn(items[i], i)
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

async function main(): Promise<void> {
  console.log("Finding venues with hero or image URLs (re-migrate + normalize duplicates)...")

  const withHero = await prisma.venue.findMany({
    where: {
      OR: [
        { heroImageUrl: { not: null } },
        { imageUrls: { not: Prisma.DbNull } },
      ],
    },
    select: { id: true, heroImageUrl: true, imageUrls: true },
  })

  const candidates = withHero.filter(
    (v) => (v.heroImageUrl && v.heroImageUrl.length > 0) || parseImageUrls(v.imageUrls).length > 0
  )

  console.log(`Found ${candidates.length} venue(s) with images (concurrency: ${CONCURRENCY_LIMIT})\n`)

  if (candidates.length === 0) {
    console.log("Nothing to do.")
    return
  }

  let processed = 0
  let updated = 0

  const processOne = async (
    venue: { id: string; heroImageUrl: string | null; imageUrls: unknown },
    i: number
  ): Promise<"updated" | "unchanged" | "error"> => {
    const currentImageUrls = parseImageUrls(venue.imageUrls)
    const currentHero = venue.heroImageUrl ?? null

    let hero: string | null
    let imageUrls: string[]

    if (hasGoogleMediaUrl(venue)) {
      const persisted = await persistVenuePhotos({
        venueId: venue.id,
        imageUrls: currentImageUrls.length > 0 ? currentImageUrls : null,
        heroImageUrl: currentHero,
      })
      hero = persisted.heroImageUrl
      imageUrls = persisted.imageUrls
    } else {
      hero = currentHero
      imageUrls = currentImageUrls
    }

    const { heroImageUrl: normHero, imageUrls: normImageUrls } = normalizeHeroAndImageUrls(hero, imageUrls)

    // Compare normalized result to actual DB values (not normalized-to-normalized)
    // so we update when DB has duplicates or hero repeated in imageUrls
    const same =
      currentHero === normHero &&
      arraysEqual(currentImageUrls, normImageUrls)

    if (same) {
      return "unchanged"
    }

    await prisma.venue.update({
      where: { id: venue.id },
      data: {
        heroImageUrl: normHero,
        imageUrls: normImageUrls.length > 0 ? normImageUrls : Prisma.DbNull,
      },
    })
    return "updated"
  }

  const results = await runWithLimit(candidates, CONCURRENCY_LIMIT, async (venue, i) => {
    try {
      const result = await processOne(venue, i)
      processed++
      if (result === "updated") updated++
      console.log(`  [${processed}/${candidates.length}] venue ${venue.id} — ${result}`)
      return result
    } catch (err) {
      processed++
      console.warn(`  [${processed}/${candidates.length}] venue ${venue.id} — error`, {
        venueId: venue.id,
        index: i,
        host: GOOGLE_HOST,
      })
      return "error" as const
    }
  })

  console.log("\nDone.")
  console.log(`  Processed: ${processed}`)
  console.log(`  Updated:   ${updated}`)
  console.log(`  Unchanged: ${results.filter((r) => r === "unchanged").length}`)
  console.log(`  Errors:    ${results.filter((r) => r === "error").length}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
