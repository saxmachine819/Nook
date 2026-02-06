/**
 * Sentry edge runtime initialization (middleware / edge API routes).
 * No-op when DSN is missing.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;
const environment = process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development";
const tracesSampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0");
const profilesSampleRate = Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? "0");

Sentry.init({
  dsn,
  environment,
  enabled: !!dsn,
  sendDefaultPii: false,
  tracesSampleRate: Math.min(1, Math.max(0, tracesSampleRate)),
  profilesSampleRate: Math.min(1, Math.max(0, profilesSampleRate)),
  release: process.env.SENTRY_RELEASE ?? undefined,
});
