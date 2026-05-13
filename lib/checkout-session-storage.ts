const STORAGE_KEY = "nooc_embedded_checkout"

export interface EmbeddedCheckoutPayload {
  clientSecret: string
  stripeAccountId?: string | null
  returnTo: string
}

export function storeEmbeddedCheckout(payload: EmbeddedCheckoutPayload): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch (error) {
    console.error("Failed to store embedded checkout session:", error)
  }
}

export function readEmbeddedCheckout(): EmbeddedCheckoutPayload | null {
  if (typeof window === "undefined") return null
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored) as EmbeddedCheckoutPayload
    if (typeof parsed.clientSecret !== "string" || !parsed.clientSecret) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearEmbeddedCheckout(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error("Failed to clear embedded checkout session:", error)
  }
}
