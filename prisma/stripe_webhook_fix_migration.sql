-- Add pendingExpiresAt to reservations
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "pendingExpiresAt" TIMESTAMP(3);

-- Create WebhookEvent table
CREATE TABLE IF NOT EXISTS "webhook_events" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB NOT NULL,
    "account" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "webhook_events_stripeEventId_key" ON "webhook_events"("stripeEventId");
CREATE INDEX IF NOT EXISTS "webhook_events_eventType_idx" ON "webhook_events"("eventType");
CREATE INDEX IF NOT EXISTS "webhook_events_createdAt_idx" ON "webhook_events"("createdAt");
