/**
 * Cal.com embed URL used for "Schedule a call" on /demo and signage booking fallback in venue dashboard.
 * Override via NEXT_PUBLIC_CAL_EMBED_URL in .env if needed.
 */
export const CAL_EMBED_URL =
  process.env.NEXT_PUBLIC_CAL_EMBED_URL ??
  "https://cal.com/jordan-cohen-3zchhq?embed=true"
