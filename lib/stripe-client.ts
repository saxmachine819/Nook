import { loadStripe, Stripe } from "@stripe/stripe-js"

const stripeInstances: Record<string, Promise<Stripe | null>> = {}

export const getStripe = (stripeAccountId?: string): Promise<Stripe | null> => {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  if (!publishableKey || typeof publishableKey !== "string") {
    return Promise.resolve(null)
  }
  const key = stripeAccountId || "default"
  if (!stripeInstances[key]) {
    stripeInstances[key] = loadStripe(
      publishableKey,
      stripeAccountId ? { stripeAccount: stripeAccountId } : undefined
    )
  }
  return stripeInstances[key]
}
