-- Enable Row Level Security (RLS) on all public schema tables.
-- Run this in Supabase Dashboard → SQL Editor (or any client as superuser).
-- After enabling, only roles that bypass RLS (e.g. postgres/DATABASE_URL) can access rows;
-- PostgREST anon/authenticated access is denied until policies are added.
-- The app uses Prisma with DATABASE_URL, which bypasses RLS, so no policies are required.

-- Core application tables
ALTER TABLE public."tables"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seats        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seat_blocks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_redemptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_venues  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_tables  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_seats  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_assets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._prisma_migrations  ENABLE ROW LEVEL SECURITY;

-- Payment tables (only enable if they exist - these may not exist in all environments)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
    ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'refund_requests') THEN
    ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
