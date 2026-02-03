import { describe, it, expect, beforeEach, vi } from "vitest"
import { enqueueNotification } from "@/lib/notification-queue"

const mockFindUnique = vi.hoisted(() => vi.fn())
const mockCreate = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notificationEvent: {
      findUnique: mockFindUnique,
      create: mockCreate,
    },
  },
}))

describe("notification-queue", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates a new row when dedupeKey does not exist and returns created: true", async () => {
    mockFindUnique.mockResolvedValue(null)
    mockCreate.mockResolvedValue({
      id: "id-1",
      dedupeKey: "key-a",
      type: "welcome",
      toEmail: "a@example.com",
      payload: {},
    })

    const result = await enqueueNotification({
      type: "welcome",
      dedupeKey: "key-a",
      toEmail: "a@example.com",
      payload: {},
    })

    expect(result).toEqual({ created: true, id: "id-1" })
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { dedupeKey: "key-a" }, select: { id: true } })
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it("returns existing row when dedupeKey already exists and does not call create", async () => {
    mockFindUnique.mockResolvedValue({ id: "id-1" })
    mockCreate.mockResolvedValue({ id: "id-1" })

    const result = await enqueueNotification({
      type: "welcome",
      dedupeKey: "key-a",
      toEmail: "a@example.com",
      payload: {},
    })

    expect(result).toEqual({ created: false, id: "id-1" })
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { dedupeKey: "key-a" }, select: { id: true } })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("creates a second row when dedupeKey is different", async () => {
    mockFindUnique.mockResolvedValue(null)
    mockCreate.mockResolvedValue({
      id: "id-2",
      dedupeKey: "key-b",
      type: "welcome",
      toEmail: "b@example.com",
      payload: {},
    })

    const result = await enqueueNotification({
      type: "welcome",
      dedupeKey: "key-b",
      toEmail: "b@example.com",
      payload: {},
    })

    expect(result).toEqual({ created: true, id: "id-2" })
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { dedupeKey: "key-b" }, select: { id: true } })
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })
})
