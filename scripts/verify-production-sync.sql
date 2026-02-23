-- ============================================================================
-- Verify Production Database Sync Status
-- ============================================================================
-- Run this BEFORE and AFTER running sync-production-to-staging.sql
-- to see what's missing and confirm everything was applied.
--
-- INTERPRETATION:
-- ✅ If a query returns NO ROWS (empty), that means nothing is missing = GOOD
-- ❌ If a query returns ROWS, those are the missing items = NEEDS SYNC
-- ============================================================================

-- ============================================================================
-- 1. Check for MISSING COLUMNS
-- ============================================================================
-- ✅ GOOD: Returns 0 rows (nothing missing)
-- ❌ BAD: Returns rows showing what columns are missing
SELECT 
    '❌ MISSING COLUMN' as status,
    table_name,
    column_name,
    'Expected but not found' as issue
FROM (
    VALUES
        ('users', 'welcomeEmailSentAt'),
        ('venues', 'placePhotoUrls'),
        ('venues', 'approvedByUserId'),
        ('venues', 'rejectedByUserId'),
        ('venues', 'ownerFirstName'),
        ('venues', 'ownerLastName'),
        ('venues', 'ownerPhone'),
        ('signage_order_items', 'designOption')
) AS expected(table_name, column_name)
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public'
    AND c.table_name = expected.table_name
    AND c.column_name = expected.column_name
)
ORDER BY table_name, column_name;

-- ============================================================================
-- 2. Check for MISSING ENUMS
-- ============================================================================
-- ✅ GOOD: Returns 0 rows (nothing missing)
-- ❌ BAD: Returns rows showing what enums are missing
SELECT 
    '❌ MISSING ENUM' as status,
    enum_name,
    'Expected but not found' as issue
FROM (
    VALUES
        ('VenueMemberRole'),
        ('PaymentStatus'),
        ('RefundStatus'),
        ('SignageOrderStatus'),
        ('SignageTemplateCategory'),
        ('SignageQrScopeType'),
        ('SignageDesignOption')
) AS expected(enum_name)
WHERE NOT EXISTS (
    SELECT 1 FROM pg_type t
    WHERE t.typname = expected.enum_name
)
ORDER BY enum_name;

-- ============================================================================
-- 3. Check for MISSING TABLES
-- ============================================================================
-- ✅ GOOD: Returns 0 rows (nothing missing)
-- ❌ BAD: Returns rows showing what tables are missing
SELECT 
    '❌ MISSING TABLE' as status,
    table_name,
    'Expected but not found' as issue
FROM (
    VALUES
        ('venue_members'),
        ('payments'),
        ('refund_requests'),
        ('signage_templates'),
        ('signage_orders'),
        ('signage_order_items')
) AS expected(table_name)
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_schema = 'public'
    AND t.table_name = expected.table_name
)
ORDER BY table_name;

-- ============================================================================
-- 4. Check for MISSING INDEXES
-- ============================================================================
-- ✅ GOOD: Returns 0 rows (nothing missing)
-- ❌ BAD: Returns rows showing what indexes are missing
SELECT 
    '❌ MISSING INDEX' as status,
    tablename,
    indexname,
    'Expected but not found' as issue
FROM (
    VALUES
        ('venue_members', 'venue_members_venueId_email_key'),
        ('payments', 'payments_stripePaymentIntentId_key'),
        ('refund_requests', 'refund_requests_stripeRefundId_key'),
        ('signage_order_items', 'signage_order_items_qrAssetId_idx')
) AS expected(tablename, indexname)
WHERE NOT EXISTS (
    SELECT 1 FROM pg_indexes i
    WHERE i.schemaname = 'public'
    AND i.tablename = expected.tablename
    AND i.indexname = expected.indexname
)
ORDER BY tablename, indexname;

-- ============================================================================
-- 5. SYNC STATUS SUMMARY
-- ============================================================================
-- Shows what EXISTS (1 = exists, 0 = missing)
-- ✅ GOOD: All values should be 1
-- ❌ BAD: Any value is 0 means that table is missing
SELECT 
    '📊 SYNC STATUS SUMMARY' as check_type,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'venue_members') THEN '✅' ELSE '❌' END as venue_members,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN '✅' ELSE '❌' END as payments,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'refund_requests') THEN '✅' ELSE '❌' END as refund_requests,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'signage_templates') THEN '✅' ELSE '❌' END as signage_templates,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'signage_orders') THEN '✅' ELSE '❌' END as signage_orders,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'signage_order_items') THEN '✅' ELSE '❌' END as signage_order_items;

-- ============================================================================
-- 6. FINAL VERDICT
-- ============================================================================
-- This will tell you if you're fully synced or not
SELECT 
    CASE 
        WHEN (
            -- Check all tables exist
            EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'venue_members')
            AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments')
            AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'refund_requests')
            AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'signage_templates')
            AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'signage_orders')
            AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'signage_order_items')
            -- Check key columns exist
            AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'welcomeEmailSentAt')
            AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'venues' AND column_name = 'placePhotoUrls')
            AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'venues' AND column_name = 'ownerPhone')
            AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'signage_order_items' AND column_name = 'designOption')
            -- Check key enums exist
            AND EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SignageDesignOption')
        ) THEN '✅ FULLY SYNCED - Production matches staging!'
        ELSE '❌ NOT FULLY SYNCED - Run sync-production-to-staging.sql'
    END as sync_status;
