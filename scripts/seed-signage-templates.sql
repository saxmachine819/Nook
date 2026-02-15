-- Seed default SignageTemplates for QR signage ordering.
-- Run this in Supabase SQL Editor (or any client connected to your DB).
-- Safe to run multiple times: only inserts when name doesn't exist.

INSERT INTO signage_templates (id, name, description, category, "isActive")
SELECT gen_random_uuid(), 'Window decal', 'QR code decal for window or glass door', 'WINDOW', true
WHERE NOT EXISTS (SELECT 1 FROM signage_templates WHERE name = 'Window decal');

INSERT INTO signage_templates (id, name, description, category, "isActive")
SELECT gen_random_uuid(), 'Counter sign', 'Standing or counter-top sign with QR code', 'COUNTER', true
WHERE NOT EXISTS (SELECT 1 FROM signage_templates WHERE name = 'Counter sign');

INSERT INTO signage_templates (id, name, description, category, "isActive")
SELECT gen_random_uuid(), 'Table tent', 'Table tent / tent card with QR code', 'TABLE_TENT', true
WHERE NOT EXISTS (SELECT 1 FROM signage_templates WHERE name = 'Table tent');

INSERT INTO signage_templates (id, name, description, category, "isActive")
SELECT gen_random_uuid(), 'Register / Store', 'Store or register area QR sign', 'REGISTER', true
WHERE NOT EXISTS (SELECT 1 FROM signage_templates WHERE name = 'Register / Store');

INSERT INTO signage_templates (id, name, description, category, "isActive")
SELECT gen_random_uuid(), 'Standard seat QR', 'Standard QR code for seat assignment', 'STANDARD', true
WHERE NOT EXISTS (SELECT 1 FROM signage_templates WHERE name = 'Standard seat QR');
