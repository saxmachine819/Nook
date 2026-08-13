import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { auth } from '@/lib/auth'
import { finalizeExpressPayment } from '@/lib/express-payment'

vi.mock('@/lib/prisma', () => ({
  prisma: { payment: { findUnique: vi.fn() } },
}))

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { retrieve: vi.fn() } },
}))

vi.mock('@/lib/express-payment', () => ({
  finalizeExpressPayment: vi.fn(),
}))

const { GET } = await import('@/app/api/payments/express/status/route')

function statusRequest(paymentId?: string) {
  const url = paymentId
    ? `http://localhost:3000/api/payments/express/status?payment_id=${paymentId}`
    : 'http://localhost:3000/api/payments/express/status'
  return new NextRequest(url, { method: 'GET' })
}

function mockPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'payment-1',
    userId: 'user-1',
    status: 'PENDING',
    reservationId: 'reservation-1',
    stripeAccountId: 'acct_venue',
    stripePaymentIntentId: 'pi_123',
    ...overrides,
  } as any
}

describe('GET /api/payments/express/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as any)
  })

  it('requires a signed-in user', async () => {
    vi.mocked(auth).mockResolvedValue(null as any)

    const response = await GET(statusRequest('payment-1'))

    expect(response.status).toBe(401)
    expect(prisma.payment.findUnique).not.toHaveBeenCalled()
  })

  it('requires a payment_id', async () => {
    const response = await GET(statusRequest())
    expect(response.status).toBe(400)
  })

  it("refuses to report on another user's payment", async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(
      mockPayment({ userId: 'someone-else' })
    )

    const response = await GET(statusRequest('payment-1'))

    expect(response.status).toBe(404)
    expect(finalizeExpressPayment).not.toHaveBeenCalled()
  })

  it('returns the same 404 for a payment that does not exist', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(null)

    const response = await GET(statusRequest('nope'))

    // Identical to the not-yours case so payment ids can't be enumerated.
    expect(response.status).toBe(404)
  })

  it('short-circuits when the payment is already paid', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(mockPayment({ status: 'PAID' }))

    const response = await GET(statusRequest('payment-1'))
    const data = await response.json()

    expect(data).toEqual({ status: 'paid', reservationId: 'reservation-1' })
    expect(stripe.paymentIntents.retrieve).not.toHaveBeenCalled()
  })

  it('finalizes the booking when Stripe reports the intent succeeded', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(mockPayment())
    vi.mocked(stripe.paymentIntents.retrieve).mockResolvedValue({
      id: 'pi_123',
      status: 'succeeded',
    } as any)
    vi.mocked(finalizeExpressPayment).mockResolvedValue({
      status: 'finalized',
      reservationId: 'reservation-1',
    })

    const response = await GET(statusRequest('payment-1'))
    const data = await response.json()

    expect(data).toEqual({ status: 'paid', reservationId: 'reservation-1' })
    expect(stripe.paymentIntents.retrieve).toHaveBeenCalledWith(
      'pi_123',
      { expand: ['latest_charge'] },
      { stripeAccount: 'acct_venue' }
    )
  })

  it('reports pending while the intent is still processing', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(mockPayment())
    vi.mocked(stripe.paymentIntents.retrieve).mockResolvedValue({
      id: 'pi_123',
      status: 'processing',
    } as any)

    const response = await GET(statusRequest('payment-1'))
    const data = await response.json()

    expect(data).toEqual({ status: 'pending', reservationId: null })
    expect(finalizeExpressPayment).not.toHaveBeenCalled()
  })

  it('reports failed for a canceled intent', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(mockPayment())
    vi.mocked(stripe.paymentIntents.retrieve).mockResolvedValue({
      id: 'pi_123',
      status: 'canceled',
    } as any)

    const response = await GET(statusRequest('payment-1'))
    const data = await response.json()

    expect(data.status).toBe('failed')
  })

  it('surfaces a refund so the client can explain what happened', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(mockPayment())
    vi.mocked(stripe.paymentIntents.retrieve).mockResolvedValue({
      id: 'pi_123',
      status: 'succeeded',
    } as any)
    vi.mocked(finalizeExpressPayment).mockResolvedValue({
      status: 'refunded',
      reason: 'Reservation not found',
    })

    const response = await GET(statusRequest('payment-1'))
    const data = await response.json()

    expect(data.status).toBe('refunded')
    expect(data.reservationId).toBeNull()
  })
})
