#!/usr/bin/env node
/**
 * Script to run Prisma migrations with proper SSL connection
 */
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Read .env file
let databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  try {
    const envContent = readFileSync(join(projectRoot, '.env'), 'utf-8');
    const match = envContent.match(/DATABASE_URL=(.+)/);
    if (match) {
      databaseUrl = match[1].trim().replace(/^["']|["']$/g, '');
    }
  } catch (error) {
    console.error('Could not read .env file');
    process.exit(1);
  }
}

if (!databaseUrl) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

// Fix SSL connection - replace verify-full with require, or add if not present
let fixedUrl = databaseUrl;
if (fixedUrl.includes('sslmode=verify-full')) {
  // Replace verify-full with require (less strict, works better with some certificates)
  fixedUrl = fixedUrl.replace('sslmode=verify-full', 'sslmode=require');
} else if (!fixedUrl.includes('sslmode=')) {
  // Add sslmode=require to the connection string
  const separator = fixedUrl.includes('?') ? '&' : '?';
  fixedUrl = `${fixedUrl}${separator}sslmode=require`;
}

// Try connection pooler port (6543) instead of direct (5432) if using direct connection
if (fixedUrl.includes(':5432/') && !fixedUrl.includes('pooler')) {
  console.log('Trying connection pooler port instead...');
  fixedUrl = fixedUrl.replace(':5432/', ':6543/');
}

// Also add connection timeout parameters
if (!fixedUrl.includes('connect_timeout=')) {
  const separator = fixedUrl.includes('?') ? '&' : '?';
  fixedUrl = `${fixedUrl}${separator}connect_timeout=30`;
}

// Set the environment variable and run prisma
process.env.DATABASE_URL = fixedUrl;

console.log('Running Prisma migration with SSL connection...');
console.log('Connection string format:', fixedUrl.replace(/:[^:@]+@/, ':****@')); // Hide password

try {
  execSync('npx prisma db push', {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env,
  });
  console.log('\n✅ Migration completed successfully!');
} catch (error) {
  console.error('\n❌ Migration failed');
  process.exit(1);
}
