import { uploadToSupabase } from "@/lib/supabase-storage"

export type PersistVenuePhotosInput = {
  venueId: string
  imageUrls?: string[] | null
  heroImageUrl?: string | null
}

export type PersistVenuePhotosOutput = {
  imageUrls: string[]
  heroImageUrl: string | null
}

const GOOGLE_MEDIA_HOST = "places.googleapis.com"
const FETCH_TIMEOUT_MS = 15_000
const CONCURRENCY_LIMIT = 3

function isGooglePlacesMediaUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.hostname === GOOGLE_MEDIA_HOST && u.pathname.includes("/media")
  } catch {
    return false
  }
}

async function runWithLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let index = 0
  async function worker(): Promise<void> {
    while (index < tasks.length) {
      const i = index++
      results[i] = await tasks[i]()
    }
  }
  const workers = Array.from(
    { length: Math.min(limit, tasks.length) },
    () => worker()
  )
  await Promise.all(workers)
  return results
}

function extensionFromContentType(contentType: string): string {
  const lower = contentType.split(";")[0].trim().toLowerCase()
  if (lower.includes("image/png")) return "png"
  if (lower.includes("image/webp")) return "webp"
  if (lower.includes("image/jpeg") || lower.includes("image/jpg")) return "jpg"
  return "jpg"
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 10)
}

export async function persistVenuePhotos(
  input: PersistVenuePhotosInput
): Promise<PersistVenuePhotosOutput> {
  const imageUrls = input.imageUrls ?? []
  const heroImageUrl = input.heroImageUrl ?? null
  const venueId = input.venueId

  const candidateUrls = [
    ...imageUrls,
    ...(heroImageUrl ? [heroImageUrl] : []),
  ]
  const uniqueGoogleUrls = [
    ...new Set(candidateUrls.filter(isGooglePlacesMediaUrl)),
  ]

  const resolvedByUrl = new Map<string, string>()

  const resolveOne = (googleUrl: string, logIndex: number) => async (): Promise<string> => {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      const res = await fetch(googleUrl, { signal: controller.signal })
      clearTimeout(timeout)
      if (!res.ok) return googleUrl
      const contentType = res.headers.get("content-type") ?? "image/jpeg"
      const arrayBuffer = await res.arrayBuffer()
      const ext = extensionFromContentType(contentType)
      const path = `venue/${venueId}/google-${randomSuffix()}.${ext}`
      const blob = new Blob([arrayBuffer], {
        type: contentType.split(";")[0].trim() || "image/jpeg",
      })
      const supabaseUrl = await uploadToSupabase(blob, path)
      return supabaseUrl ?? googleUrl
    } catch {
      console.warn({ venueId, index: logIndex, host: GOOGLE_MEDIA_HOST })
      return googleUrl
    }
  }

  const tasks = uniqueGoogleUrls.map((url, i) => resolveOne(url, i))
  const results = await runWithLimit(tasks, CONCURRENCY_LIMIT)
  uniqueGoogleUrls.forEach((url, i) => resolvedByUrl.set(url, results[i]))

  const persistedCount = uniqueGoogleUrls.filter((url, i) => results[i] !== url).length
  if (persistedCount > 0) {
    console.log(`Persisted ${persistedCount} Google photos for venue ${venueId}`)
  }

  // Map to resolved URLs, then dedupe (same URL only once, preserve order) to avoid duplicate photos in UI
  const mapped = imageUrls.map((url) =>
    isGooglePlacesMediaUrl(url) ? resolvedByUrl.get(url) ?? url : url
  )
  const seen = new Set<string>()
  const outImageUrls = mapped.filter((url) => {
    if (seen.has(url)) return false
    seen.add(url)
    return true
  })
  const outHeroImageUrl = heroImageUrl
    ? isGooglePlacesMediaUrl(heroImageUrl)
      ? resolvedByUrl.get(heroImageUrl) ?? heroImageUrl
      : heroImageUrl
    : null

  // Canonical form: imageUrls must not contain the hero so venue profile never shows duplicates
  const imageUrlsWithoutHero = outImageUrls.filter((u) => u !== outHeroImageUrl)

  return { imageUrls: imageUrlsWithoutHero, heroImageUrl: outHeroImageUrl }
}

const PLACE_PHOTOS_MAX = 10

/**
 * Persist all place photos (Google media URLs) to Supabase. Used so the edit catalog
 * can be entirely Supabase URLs and selection is simple. SSRF: only Google Places media URLs.
 */
export async function persistPlacePhotoUrls(
  venueId: string,
  googlePhotoUrls: string[]
): Promise<string[]> {
  const allowed = googlePhotoUrls
    .filter(isGooglePlacesMediaUrl)
    .slice(0, PLACE_PHOTOS_MAX)

  const resolveOne = (googleUrl: string, logIndex: number) => async (): Promise<string> => {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      const res = await fetch(googleUrl, { signal: controller.signal })
      clearTimeout(timeout)
      if (!res.ok) return googleUrl
      const contentType = res.headers.get("content-type") ?? "image/jpeg"
      const arrayBuffer = await res.arrayBuffer()
      const ext = extensionFromContentType(contentType)
      const path = `venue/${venueId}/place-${logIndex}.${ext}`
      const blob = new Blob([arrayBuffer], {
        type: contentType.split(";")[0].trim() || "image/jpeg",
      })
      const supabaseUrl = await uploadToSupabase(blob, path)
      return supabaseUrl ?? googleUrl
    } catch {
      console.warn({ venueId, index: logIndex, host: GOOGLE_MEDIA_HOST })
      return googleUrl
    }
  }

  const tasks = allowed.map((url, i) => resolveOne(url, i))
  const results = await runWithLimit(tasks, CONCURRENCY_LIMIT)
  const persistedCount = results.filter((url, i) => url !== allowed[i]).length
  if (persistedCount > 0) {
    console.log(`Persisted ${persistedCount} place photos for venue ${venueId}`)
  }
  return results
}
