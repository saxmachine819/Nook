import { loadStripe, Stripe } from "@stripe/stripe-js"

const stripeInstances: Record<string, Promise<Stripe | null>> = {}

export const getStripe = (stripeAccountId?: string) => {
  const key = stripeAccountId || "default"
  if (!stripeInstances[key]) {
    stripeInstances[key] = loadStripe(
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
      stripeAccountId ? { stripeAccount: stripeAccountId } : undefined
    )
  }
  return stripeInstances[key]
}
