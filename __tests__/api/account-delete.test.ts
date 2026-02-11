import { describe, it, expect, beforeEach, vi } from "vitest"
import { createMockPrisma, createMockSession } from "../setup/mocks"
import { createTestUser } from "../helpers/test-utils"

const mockPrisma = createMockPrisma()
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))
vi.mock("@/lib/auth", () => ({ auth: vi.fn() as any }))
vi.mock("@/lib/audit", () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }))

const { POST } = await import("@/app/api/account/delete/route")

describe("POST /api/account/delete", () => {
  const userId = "user-1"
  const user = createTestUser({ id: userId, status: "ACTIVE" })

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(user as any)
    vi.mocked(mockPrisma.$transaction).mockImplementation(async (cb) => {
      const tx = {
        reservation: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        venue: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        user: { update: vi.fn().mockResolvedValue(user) },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      }
      return (cb as any)(tx)
    })
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth).mockResolvedValue(createMockSession(user) as any)
  })

  it("returns 401 if not authenticated", async () => {
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth).mockResolvedValue(null as any)

    const req = new Request("http://localhost/api/account/delete", {
      method: "POST",
      body: JSON.stringify({ confirmation: "DELETE" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("returns 400 if confirmation is not DELETE", async () => {
    const req = new Request("http://localhost/api/account/delete", {
      method: "POST",
      body: JSON.stringify({ confirmation: "delete" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("DELETE")
  })

  it("returns 409 if user is already DELETED", async () => {
    vi.mocked(mockPrisma.user.findUnique).mockResolvedValue({
      ...user,
      status: "DELETED",
    } as any)

    const req = new Request("http://localhost/api/account/delete", {
      method: "POST",
      body: JSON.stringify({ confirmation: "DELETE" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toContain("already deleted")
  })

  it("returns 200 and runs transaction when confirmation is DELETE", async () => {
    const req = new Request("http://localhost/api/account/delete", {
      method: "POST",
      body: JSON.stringify({ confirmation: "DELETE", reason: "No longer needed" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.message).toBeDefined()
    expect(mockPrisma.$transaction).toHaveBeenCalled()
  })
})
