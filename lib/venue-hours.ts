type GoogleOpeningHours = {
  timeZone?: string
  weekdayDescriptions?: string[]
  periods?: Array<{
    open: {
      day: number
      hour: number
      minute: number
    }
    close?: {
      day: number
      hour: number
      minute: number
    }
  }>
}

const DAY_ABBREVIATIONS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM"
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  const displayMinute = minute.toString().padStart(2, "0")
  return `${displayHour}:${displayMinute} ${period}`
}

export function parseGoogleHours(openingHoursJson: unknown): {
  formatted: string[]
  hasHours: boolean
} {
  if (!openingHoursJson) {
    return { formatted: [], hasHours: false }
  }

  const hours = openingHoursJson as GoogleOpeningHours

  if (hours.weekdayDescriptions && Array.isArray(hours.weekdayDescriptions) && hours.weekdayDescriptions.length > 0) {
    return {
      formatted: hours.weekdayDescriptions,
      hasHours: true,
    }
  }

  if (hours.periods && Array.isArray(hours.periods) && hours.periods.length > 0) {
    const dayMap = new Map<number, Array<{ open: string; close: string | null }>>()

    for (let i = 0; i < 7; i++) {
      dayMap.set(i, [])
    }

    for (const period of hours.periods) {
      if (!period.open) continue

      const openDay = period.open.day
      const openTime = formatTime(period.open.hour, period.open.minute)

      if (!period.close) {
        dayMap.get(openDay)?.push({ open: openTime, close: null })
        continue
      }

      const closeDay = period.close.day
      const closeTime = formatTime(period.close.hour, period.close.minute)

      if (openDay === closeDay) {
        dayMap.get(openDay)?.push({ open: openTime, close: closeTime })
      } else {
        dayMap.get(openDay)?.push({ open: openTime, close: "11:59 PM" })
        dayMap.get(closeDay)?.push({ open: "12:00 AM", close: closeTime })
      }
    }

    const formatted: string[] = []
    for (let i = 0; i < 7; i++) {
      const intervals = dayMap.get(i) || []
      if (intervals.length === 0) {
        formatted.push(`${DAY_ABBREVIATIONS[i]}: Closed`)
      } else {
        const intervalStrs = intervals.map((interval) => {
          if (interval.close === null) {
            return `${interval.open} – 11:59 PM`
          }
          return `${interval.open} – ${interval.close}`
        })
        formatted.push(`${DAY_ABBREVIATIONS[i]}: ${intervalStrs.join(", ")}`)
      }
    }

    return {
      formatted,
      hasHours: true,
    }
  }

  return { formatted: [], hasHours: false }
}

function formatTimeHHMM(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
}

export function parseGooglePeriodsToVenueHoursWithTimezone(
  periods: Array<{
    open: {
      day: number
      hour: number
      minute: number
    }
    close?: {
      day: number
      hour: number
      minute: number
    }
  }>,
  venueId: string,
  timezone: string,
  source: string = "google"
): Array<{
  venueId: string
  dayOfWeek: number
  isClosed: boolean
  openTime: string | null
  closeTime: string | null
  source: string
}> {
  const days: Array<{
    venueId: string
    dayOfWeek: number
    isClosed: boolean
    openTime: string | null
    closeTime: string | null
    source: string
  }> = []

  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    days.push({
      venueId,
      dayOfWeek,
      isClosed: true,
      openTime: null,
      closeTime: null,
      source,
    })
  }

  if (!periods || !Array.isArray(periods) || periods.length === 0) {
    return days
  }

  for (const period of periods) {
    if (!period.open) continue

    const openDay = period.open.day
    const openTime = formatTimeHHMM(period.open.hour, period.open.minute)

    if (!period.close) {
      if (days[openDay].isClosed) {
        days[openDay] = {
          venueId,
          dayOfWeek: openDay,
          isClosed: false,
          openTime,
          closeTime: "23:59",
          source,
        }
      } else {
        if (!days[openDay].openTime || days[openDay].openTime! > openTime) {
          days[openDay].openTime = openTime
        }
        days[openDay].closeTime = "23:59"
      }
      continue
    }

    const closeDay = period.close.day
    const closeTime = formatTimeHHMM(period.close.hour, period.close.minute)

    if (openDay === closeDay) {
      if (days[openDay].isClosed) {
        days[openDay] = {
          venueId,
          dayOfWeek: openDay,
          isClosed: false,
          openTime,
          closeTime,
          source,
        }
      } else {
        if (!days[openDay].openTime || days[openDay].openTime! > openTime) {
          days[openDay].openTime = openTime
        }
        if (!days[openDay].closeTime || days[openDay].closeTime! < closeTime) {
          days[openDay].closeTime = closeTime
        }
      }
    } else {
      if (days[openDay].isClosed) {
        days[openDay] = {
          venueId,
          dayOfWeek: openDay,
          isClosed: false,
          openTime,
          closeTime: "23:59",
          source,
        }
      } else {
        if (!days[openDay].openTime || days[openDay].openTime! > openTime) {
          days[openDay].openTime = openTime
        }
        days[openDay].closeTime = "23:59"
      }

      if (days[closeDay].isClosed) {
        days[closeDay] = {
          venueId,
          dayOfWeek: closeDay,
          isClosed: false,
          openTime: "00:00",
          closeTime,
          source,
        }
      } else {
        days[closeDay].openTime = "00:00"
        if (!days[closeDay].closeTime || days[closeDay].closeTime! < closeTime) {
          days[closeDay].closeTime = closeTime
        }
      }
    }
  }

  return days
}

export function parseGooglePeriodsToVenueHours(
  periods: Array<{
    open: {
      day: number
      hour: number
      minute: number
    }
    close?: {
      day: number
      hour: number
      minute: number
    }
  }>,
  venueId: string,
  source: string = "google"
): Array<{
  venueId: string
  dayOfWeek: number
  isClosed: boolean
  openTime: string | null
  closeTime: string | null
  source: string
}> {
  const days: Array<{
    venueId: string
    dayOfWeek: number
    isClosed: boolean
    openTime: string | null
    closeTime: string | null
    source: string
  }> = []

  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    days.push({
      venueId,
      dayOfWeek,
      isClosed: true,
      openTime: null,
      closeTime: null,
      source,
    })
  }

  if (!periods || !Array.isArray(periods) || periods.length === 0) {
    return days
  }

  for (const period of periods) {
    if (!period.open) continue

    const openDay = period.open.day
    const openTime = formatTimeHHMM(period.open.hour, period.open.minute)

    if (!period.close) {
      if (days[openDay].isClosed) {
        days[openDay] = {
          venueId,
          dayOfWeek: openDay,
          isClosed: false,
          openTime: "00:00",
          closeTime: "23:59",
          source,
        }
      } else {
        if (!days[openDay].openTime || days[openDay].openTime! > openTime) {
          days[openDay].openTime = "00:00"
        }
        days[openDay].closeTime = "23:59"
      }
      continue
    }

    const closeDay = period.close.day
    const closeTime = formatTimeHHMM(period.close.hour, period.close.minute)

    if (openDay === closeDay) {
      if (days[openDay].isClosed) {
        days[openDay] = {
          venueId,
          dayOfWeek: openDay,
          isClosed: false,
          openTime,
          closeTime,
          source,
        }
      } else {
        if (!days[openDay].openTime || days[openDay].openTime! > openTime) {
          days[openDay].openTime = openTime
        }
        if (!days[openDay].closeTime || days[openDay].closeTime! < closeTime) {
          days[openDay].closeTime = closeTime
        }
      }
    } else {
      if (days[openDay].isClosed) {
        days[openDay] = {
          venueId,
          dayOfWeek: openDay,
          isClosed: false,
          openTime,
          closeTime: "23:59",
          source,
        }
      } else {
        if (!days[openDay].openTime || days[openDay].openTime! > openTime) {
          days[openDay].openTime = openTime
        }
        days[openDay].closeTime = "23:59"
      }

      if (days[closeDay].isClosed) {
        days[closeDay] = {
          venueId,
          dayOfWeek: closeDay,
          isClosed: false,
          openTime: "00:00",
          closeTime,
          source,
        }
      } else {
        days[closeDay].openTime = "00:00"
        if (!days[closeDay].closeTime || days[closeDay].closeTime! < closeTime) {
          days[closeDay].closeTime = closeTime
        }
      }
    }
  }

  return days
}

export type VenueHoursRow = {
  dayOfWeek: number
  isClosed: boolean
  openTime: string | null
  closeTime: string | null
  source?: string
}

export function getEffectiveVenueHours(
  venueHours: VenueHoursRow[],
  hoursSource: string | null | undefined
): VenueHoursRow[] {
  if (!venueHours || venueHours.length === 0) return []
  if (hoursSource === "manual") {
    return venueHours.filter((h) => h.source === "manual")
  }
  return venueHours.filter((h) => h.source === "google" || h.source === undefined)
}

export async function syncVenueHoursFromGoogle(
  prisma: unknown,
  venueId: string,
  hoursData: Array<{
    venueId: string
    dayOfWeek: number
    isClosed: boolean
    openTime: string | null
    closeTime: string | null
    source: string
  }>,
  hoursSource: string | null | undefined
): Promise<void> {
  const p = prisma as {
    venueHours: {
      findMany: (args: { where: { venueId: string }; select: { dayOfWeek: boolean; source: boolean } }) => Promise<{ dayOfWeek: number; source: string }[]>
      upsert: (args: {
        where: { venueId_dayOfWeek: { venueId: string; dayOfWeek: number } }
        update: { isClosed: boolean; openTime: string | null; closeTime: string | null; source: string }
        create: { venueId: string; dayOfWeek: number; isClosed: boolean; openTime: string | null; closeTime: string | null; source: string }
      }) => Promise<unknown>
    }
  }

  if (hoursSource === "manual") {
    const existing = await p.venueHours.findMany({
      where: { venueId },
      select: { dayOfWeek: true, source: true },
    })
    const existingByDay = new Map(existing.map((r) => [r.dayOfWeek, r.source]))
    for (const dayData of hoursData) {
      if (existingByDay.get(dayData.dayOfWeek) === "manual") continue
      await p.venueHours.upsert({
        where: {
          venueId_dayOfWeek: {
            venueId,
            dayOfWeek: dayData.dayOfWeek,
          },
        },
        update: {
          isClosed: dayData.isClosed,
          openTime: dayData.openTime,
          closeTime: dayData.closeTime,
          source: dayData.source,
        },
        create: dayData,
      })
    }
    return
  }
  await upsertVenueHours(prisma, venueId, hoursData)
}

export async function upsertVenueHours(
  prisma: unknown,
  venueId: string,
  hoursData: Array<{
    venueId: string
    dayOfWeek: number
    isClosed: boolean
    openTime: string | null
    closeTime: string | null
    source: string
  }>
): Promise<void> {
  const p = prisma as {
    venueHours: {
      upsert: (args: {
        where: { venueId_dayOfWeek: { venueId: string; dayOfWeek: number } }
        update: { isClosed: boolean; openTime: string | null; closeTime: string | null; source: string }
        create: { venueId: string; dayOfWeek: number; isClosed: boolean; openTime: string | null; closeTime: string | null; source: string }
      }) => Promise<unknown>
    }
  }

  for (const dayData of hoursData) {
    await p.venueHours.upsert({
      where: {
        venueId_dayOfWeek: {
          venueId: dayData.venueId,
          dayOfWeek: dayData.dayOfWeek,
        },
      },
      update: {
        isClosed: dayData.isClosed,
        openTime: dayData.openTime,
        closeTime: dayData.closeTime,
        source: dayData.source,
      },
      create: dayData,
    })
  }
}
