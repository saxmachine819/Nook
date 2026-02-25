import { prisma } from "@/lib/prisma"

export async function getSiteSetting(key: string): Promise<string | null> {
  try {
    const setting = await prisma.siteSetting.findUnique({ where: { key } })
    return setting?.value ?? null
  } catch {
    return null
  }
}

export async function setSiteSetting(key: string, value: string): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
}

export async function isSearchLandingEnabled(): Promise<boolean> {
  const value = await getSiteSetting("search_landing_enabled")
  return value === "true"
}
