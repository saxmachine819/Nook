import { describe, it, expect, beforeEach } from "vitest"
import {
  UPCOMING_CACHE_KEY,
  writeUpcomingCache,
  readUpcomingCache,
} from "@/lib/native-app"

describe("native-app reservation cache", () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: globalThis,
    })
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v)
        },
        removeItem: (k: string) => {
          store.delete(k)
        },
      },
    })
  })

  it("exposes a stable cache key", () => {
    expect(UPCOMING_CACHE_KEY).toBe("nooc.upcomingReservations.v1")
  })

  it("round-trips upcoming reservations in localStorage", () => {
    writeUpcomingCache([
      {
        id: "r1",
        venueName: "Cafe",
        startAt: "2026-08-07T15:00:00.000Z",
        endAt: "2026-08-07T17:00:00.000Z",
      },
    ])
    const items = readUpcomingCache()
    expect(items).toHaveLength(1)
    expect(items[0].venueName).toBe("Cafe")
  })
})
