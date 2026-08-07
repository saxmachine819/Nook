import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    devicePushToken: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { POST, DELETE } from "@/app/api/devices/push-token/route"

describe("POST /api/devices/push-token", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as any)
    const req = new NextRequest("http://localhost/api/devices/push-token", {
      method: "POST",
      body: JSON.stringify({ token: "abc", platform: "ios" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("upserts a token for the signed-in user", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user_1" } } as any)
    vi.mocked(prisma.devicePushToken.upsert).mockResolvedValue({
      id: "tok_1",
      platform: "ios",
    } as any)

    const req = new NextRequest("http://localhost/api/devices/push-token", {
      method: "POST",
      body: JSON.stringify({ token: "device-token", platform: "ios" }),
    })
    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(prisma.devicePushToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: "device-token" },
        create: expect.objectContaining({
          userId: "user_1",
          platform: "ios",
        }),
      })
    )
  })

  it("rejects invalid platform", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user_1" } } as any)
    const req = new NextRequest("http://localhost/api/devices/push-token", {
      method: "POST",
      body: JSON.stringify({ token: "abc", platform: "webos" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

describe("DELETE /api/devices/push-token", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("deletes the token for the user", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user_1" } } as any)
    vi.mocked(prisma.devicePushToken.deleteMany).mockResolvedValue({ count: 1 } as any)
    const req = new NextRequest("http://localhost/api/devices/push-token", {
      method: "DELETE",
      body: JSON.stringify({ token: "device-token" }),
    })
    const res = await DELETE(req)
    expect(res.status).toBe(200)
    expect(prisma.devicePushToken.deleteMany).toHaveBeenCalled()
  })
})
