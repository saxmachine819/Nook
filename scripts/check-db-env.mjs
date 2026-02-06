#!/usr/bin/env node
/**
 * Prints DATABASE_URL host and port only (no secrets). Use to verify .env has pooler (port 6543) for local.
 * Run: node scripts/check-db-env.mjs
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  try {
    const envContent = readFileSync(join(projectRoot, '.env'), 'utf-8');
    const match = envContent.match(/DATABASE_URL=(.+)/m);
    if (match) databaseUrl = match[1].trim().replace(/^["']|["']$/g, '');
  } catch (_) {}
}

if (!databaseUrl) {
  console.log('DATABASE_URL: not set or not found in .env');
  process.exit(0);
}

let host = '';
let port = '';
try {
  const u = new URL(databaseUrl);
  host = u.hostname;
  port = u.port || '5432';
} catch (_) {}

const isPooler = host.includes('pooler') && port === '6543';
console.log('From .env (or process.env):');
console.log('  host:', host || '(parse failed)');
console.log('  port:', port);
console.log('  pooler (6543)?', isPooler ? 'YES' : 'NO — use Supabase Connection pooling URI for local');
process.exit(0);
