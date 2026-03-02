'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface RecoverPendingReservationResult {
  success: boolean
  error?: string
  checkoutUrl?: string
}

/**
 * Server action to recover a pending reservation after user signs in.
 * This is called on the venue page after OAuth redirect if there's a pending reservation.
 */
export async function recoverPendingReservation(pendingData: {
  venueId: string
  startAt: string
  endAt: string
  seatId?: string | null
  tableId?: string | null
  seatCount: number
}): Promise<RecoverPendingReservationResult> {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return { success: false, error: 'You must be signed in to complete this reservation.' }
    }

    const userRecord = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, termsAcceptedAt: true },
    })

    if (!userRecord) {
      return { success: false, error: 'User account not found. Please sign out and sign in again.' }
    }

    if (!userRecord.termsAcceptedAt) {
      return {
        success: false,
        error: 'You must accept the Terms & Conditions to make a reservation.',
      }
    }

    // Validate venue exists and is approved
    const venue = await prisma.venue.findUnique({
      where: { id: pendingData.venueId },
      select: { id: true, stripeAccountId: true, status: true, onboardingStatus: true },
    })

    if (!venue) {
      return { success: false, error: 'Venue not found.' }
    }

    if (venue.status === 'DELETED' || venue.onboardingStatus !== 'APPROVED') {
      return { success: false, error: 'This venue is not available for booking.' }
    }

    if (!venue.stripeAccountId) {
      return { success: false, error: 'This venue is not connected to Stripe yet.' }
    }

    // Validate start time is in the future
    const startAt = new Date(pendingData.startAt)
    const now = new Date()
    if (startAt < now) {
      return {
        success: false,
        error: 'This reservation time has passed. Please select a new time.',
      }
    }

    // Create reservation with pending status
    const reservation = await prisma.reservation.create({
      data: {
        venueId: pendingData.venueId,
        tableId: pendingData.tableId || null,
        seatId: pendingData.seatId || null,
        userId: session.user.id,
        startAt,
        endAt: new Date(pendingData.endAt),
        pendingExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        seatCount: pendingData.seatCount,
        status: 'pending',
      },
    })

    // Create Stripe checkout session
    const { stripe } = await import('@/lib/stripe')
    const COMMISSION_RATE = 0.2

    // Get venue for pricing
    const venueWithTables = await prisma.venue.findUnique({
      where: { id: pendingData.venueId },
      select: {
        id: true,
        name: true,
        tables: {
          include: { seats: true },
        },
      },
    })

    if (!venueWithTables) {
      await prisma.reservation.delete({ where: { id: reservation.id } })
      return { success: false, error: 'Venue not found.' }
    }

    // Calculate price (simplified - should match computeBookingPrice logic)
    let amountCents = 0
    if (pendingData.seatId) {
      const seat = venueWithTables.tables
        .flatMap((t: any) => t.seats)
        .find((s: any) => s.id === pendingData.seatId)
      if (seat) {
        const durationHours =
          (startAt.getTime() - new Date(pendingData.endAt).getTime()) / (1000 * 60 * 60)
        amountCents = Math.round(seat.pricePerHour * durationHours * 100)
      }
    }

    if (amountCents <= 0) {
      await prisma.reservation.delete({ where: { id: reservation.id } })
      return { success: false, error: 'Unable to calculate price.' }
    }

    const nookCommission = Math.round(amountCents * COMMISSION_RATE)
    const applicationFeeAmount = Math.max(0, Math.min(amountCents, nookCommission))

    const checkoutSession = await stripe.checkout.sessions.create(
      {
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Reservation at ${venueWithTables.name}`,
                description: `${pendingData.seatCount} seat(s) for ${Math.round((startAt.getTime() - new Date(pendingData.endAt).getTime()) / (1000 * 60 * 60))} hours`,
              },
              unit_amount: amountCents,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/cancel`,
        payment_intent_data: {
          application_fee_amount: applicationFeeAmount,
          transfer_data: { destination: venue.stripeAccountId },
        },
        metadata: {
          reservationId: reservation.id,
          venueId: venue.id,
        },
      },
      { stripeAccount: venue.stripeAccountId }
    )

    if (!checkoutSession.url) {
      await prisma.reservation.update({
        where: { id: reservation.id },
        data: { status: 'cancelled' },
      })
      return { success: false, error: 'Failed to create checkout session.' }
    }

    return {
      success: true,
      checkoutUrl: checkoutSession.url,
    }
  } catch (error: unknown) {
    console.error('Error recovering pending reservation:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to recover reservation. Please try again.',
    }
  }
}

/**
 * Clean up expired pending reservations (called periodically or on page load)
 */
export async function cleanupExpiredPendingReservations(): Promise<void> {
  try {
    await prisma.reservation.updateMany({
      where: {
        status: 'pending',
        pendingExpiresAt: { lt: new Date() },
      },
      data: {
        status: 'cancelled',
      },
    })
  } catch (error) {
    console.error('Error cleaning up expired pending reservations:', error)
  }
}
