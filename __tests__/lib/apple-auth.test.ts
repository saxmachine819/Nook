import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { isAppleSignInConfigured } from "@/lib/apple-auth"

describe("isAppleSignInConfigured", () => {
  const keys = [
    "APPLE_ID",
    "APPLE_SECRET",
    "APPLE_TEAM_ID",
    "APPLE_KEY_ID",
    "APPLE_PRIVATE_KEY",
  ] as const
  const snapshot: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const k of keys) {
      snapshot[k] = process.env[k]
      delete process.env[k]
    }
  })

  afterEach(() => {
    for (const k of keys) {
      if (snapshot[k] === undefined) delete process.env[k]
      else process.env[k] = snapshot[k]
    }
  })

  it("is false when nothing is set", () => {
    expect(isAppleSignInConfigured()).toBe(false)
  })

  it("is true when APPLE_ID + APPLE_SECRET are set", () => {
    process.env.APPLE_ID = "com.nooc.app.siwa"
    process.env.APPLE_SECRET = "jwt-secret"
    expect(isAppleSignInConfigured()).toBe(true)
  })

  it("is true when key material is set", () => {
    process.env.APPLE_ID = "com.nooc.app.siwa"
    process.env.APPLE_TEAM_ID = "TEAM"
    process.env.APPLE_KEY_ID = "KEY"
    process.env.APPLE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----"
    expect(isAppleSignInConfigured()).toBe(true)
  })
})
