import { PrismaClient } from "@prisma/client"
import { readFileSync } from "fs"
import { join } from "path"

const prisma = new PrismaClient()

// Split SQL into individual statements, handling DO blocks
function splitSQL(sql: string): string[] {
  const statements: string[] = []
  let current = ""
  let inDoBlock = false
  let dollarQuoteTag = ""
  let depth = 0
  
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i]
    const nextChars = sql.substring(i, i + 10)
    
    // Check for DO $$ blocks
    if (!inDoBlock && /^DO\s+\$\$/.test(nextChars)) {
      inDoBlock = true
      dollarQuoteTag = "$$"
      depth = 1
      current += char
      i += 2 // Skip "DO"
      continue
    }
    
    if (inDoBlock) {
      current += char
      // Check for end of DO block ($$;)
      if (char === "$" && sql[i + 1] === "$") {
        if (sql[i + 2] === ";") {
          statements.push(current.trim())
          current = ""
          inDoBlock = false
          i += 2 // Skip "$$;"
          continue
        }
      }
    } else {
      current += char
      if (char === ";") {
        const trimmed = current.trim()
        if (trimmed && !trimmed.startsWith("--")) {
          statements.push(trimmed)
        }
        current = ""
      }
    }
  }
  
  if (current.trim() && !current.trim().startsWith("--")) {
    statements.push(current.trim())
  }
  
  return statements.filter((s) => s.length > 0)
}

async function main() {
  console.log("📦 Applying payments migration...")
  
  // Read the migration SQL file
  const migrationPath = join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260211112750_add_payments_tables",
    "migration.sql"
  )
  
  const sql = readFileSync(migrationPath, "utf-8")
  const statements = splitSQL(sql)
  
  console.log(`📝 Found ${statements.length} SQL statements to execute`)
  
  // Execute each statement
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]
    if (!statement || statement.trim().length === 0 || statement.trim().startsWith("--")) {
      continue
    }
    
    try {
      await prisma.$executeRawUnsafe(statement)
      console.log(`✅ Executed statement ${i + 1}/${statements.length}`)
    } catch (error: any) {
      // If objects already exist, that's OK (IF NOT EXISTS handles it)
      if (
        error.message?.includes("already exists") ||
        error.message?.includes("duplicate") ||
        error.message?.includes("constraint") && error.message?.includes("already exists")
      ) {
        console.log(`⚠️  Statement ${i + 1} skipped (object already exists - this is OK)`)
      } else {
        console.error(`❌ Error executing statement ${i + 1}:`, error.message)
        console.error(`Statement: ${statement.substring(0, 100)}...`)
        throw error
      }
    }
  }
  
  console.log("✅ Migration SQL applied successfully!")
  
  // Mark migration as applied in Prisma's migration table
  try {
    await prisma.$executeRaw`
      INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
      VALUES (
        gen_random_uuid()::text,
        '',
        NOW(),
        '20260211112750_add_payments_tables',
        NOW(),
        1
      )
      ON CONFLICT DO NOTHING
    `
    console.log("✅ Migration marked as applied in Prisma migration history")
  } catch (error: any) {
    console.log("⚠️  Could not mark migration in history (may already be marked):", error.message)
  }
}

main()
  .catch((e) => {
    console.error("❌ Migration failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
