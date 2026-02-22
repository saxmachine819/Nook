-- ============================================================================
-- Enable Row Level Security (RLS) on Signage Tables
-- ============================================================================
-- Run this in Supabase Dashboard → SQL Editor to fix security advisories.
-- 
-- This enables RLS on the signage tables. Since the app uses Prisma with
-- DATABASE_URL (which bypasses RLS), no policies are needed - just enabling
-- RLS satisfies Supabase's security requirements.
-- ============================================================================

-- Enable RLS on signage tables (only if they exist)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'signage_templates') THEN
    ALTER TABLE public.signage_templates ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS enabled on signage_templates';
  ELSE
    RAISE NOTICE 'Table signage_templates does not exist, skipping';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'signage_orders') THEN
    ALTER TABLE public.signage_orders ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS enabled on signage_orders';
  ELSE
    RAISE NOTICE 'Table signage_orders does not exist, skipping';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'signage_order_items') THEN
    ALTER TABLE public.signage_order_items ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS enabled on signage_order_items';
  ELSE
    RAISE NOTICE 'Table signage_order_items does not exist, skipping';
  END IF;
END $$;

-- Verify RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('signage_templates', 'signage_orders', 'signage_order_items')
ORDER BY tablename;
