import { PrismaClient } from "@prisma/client"
import { readFileSync } from "fs"

interface TableInfo {
  table_name: string
  column_name: string
  data_type: string
  is_nullable: string
  column_default: string | null
}

interface EnumInfo {
  enum_name: string
  enum_value: string
}

interface IndexInfo {
  indexname: string
  tablename: string
}

interface ConstraintInfo {
  constraint_name: string
  table_name: string
  constraint_type: string
}

async function getDatabaseInfo(prisma: PrismaClient, dbName: string) {
  console.log(`\n📊 Checking ${dbName}...`)
  
  try {
    // Get all tables
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `
    
    // Get all enums
    const enums = await prisma.$queryRaw<Array<EnumInfo>>`
      SELECT t.typname as enum_name, e.enumlabel as enum_value
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid  
      WHERE t.typname NOT LIKE 'pg_%'
      ORDER BY t.typname, e.enumsortorder
    `
    
    // Get payment-related tables specifically
    const paymentTables = tables.filter(t => 
      t.table_name === 'payments' || 
      t.table_name === 'refund_requests'
    )
    
    // Get payment-related enums (unique enum names)
    const paymentEnumNames = [...new Set(enums
      .filter(e => e.enum_name === 'PaymentStatus' || e.enum_name === 'RefundStatus')
      .map(e => e.enum_name))]
    
    const paymentEnums = paymentEnumNames.map(name => ({
      enum_name: name,
      enum_value: enums.filter(e => e.enum_name === name).map(e => e.enum_value)
    }))
    
    // Get columns for payment tables
    const paymentColumns: Record<string, TableInfo[]> = {}
    for (const table of paymentTables) {
      const columns = await prisma.$queryRaw<Array<TableInfo>>`
        SELECT 
          table_name,
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = ${table.table_name}
        ORDER BY ordinal_position
      `
      paymentColumns[table.table_name] = columns
    }
    
    // Get indexes for payment tables
    const paymentIndexes: Record<string, IndexInfo[]> = {}
    for (const table of paymentTables) {
      const indexes = await prisma.$queryRaw<Array<IndexInfo>>`
        SELECT 
          indexname,
          tablename
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = ${table.table_name}
        ORDER BY indexname
      `
      paymentIndexes[table.table_name] = indexes
    }
    
    // Get foreign keys for payment tables
    const paymentConstraints: Record<string, ConstraintInfo[]> = {}
    for (const table of paymentTables) {
      const constraints = await prisma.$queryRaw<Array<ConstraintInfo>>`
        SELECT 
          tc.constraint_name,
          tc.table_name,
          tc.constraint_type
        FROM information_schema.table_constraints tc
        WHERE tc.table_schema = 'public'
        AND tc.table_name = ${table.table_name}
        ORDER BY tc.constraint_name
      `
      paymentConstraints[table.table_name] = constraints
    }
    
    return {
      dbName,
      allTables: tables.map(t => t.table_name),
      paymentTables: paymentTables.map(t => t.table_name),
      paymentEnums: paymentEnumNames,
      paymentColumns,
      paymentIndexes,
      paymentConstraints,
      enumValues: paymentEnums.reduce((acc, e) => {
        acc[e.enum_name] = e.enum_value
        return acc
      }, {} as Record<string, string[]>)
    }
  } catch (error: any) {
    console.error(`❌ Error checking ${dbName}:`, error.message)
    throw error
  }
}

function compareDatabases(db1: any, db2: any) {
  console.log("\n" + "=".repeat(60))
  console.log("🔍 COMPARISON RESULTS")
  console.log("=".repeat(60))
  
  let hasDifferences = false
  
  // Compare payment tables
  console.log("\n📋 Payment Tables:")
  const db1Tables = new Set(db1.paymentTables)
  const db2Tables = new Set(db2.paymentTables)
  
  const missingInDb2 = [...db1Tables].filter(t => !db2Tables.has(t))
  const missingInDb1 = [...db2Tables].filter(t => !db1Tables.has(t))
  
  if (missingInDb2.length > 0) {
    console.log(`  ❌ Missing in ${db2.dbName}: ${missingInDb2.join(", ")}`)
    hasDifferences = true
  }
  if (missingInDb1.length > 0) {
    console.log(`  ❌ Missing in ${db1.dbName}: ${missingInDb1.join(", ")}`)
    hasDifferences = true
  }
  if (missingInDb2.length === 0 && missingInDb1.length === 0) {
    console.log(`  ✅ Both databases have: ${db1.paymentTables.join(", ")}`)
  }
  
  // Compare enums
  console.log("\n📋 Payment Enums:")
  const db1Enums = new Set(db1.paymentEnums)
  const db2Enums = new Set(db2.paymentEnums)
  
  const missingEnumsInDb2 = [...db1Enums].filter(e => !db2Enums.has(e))
  const missingEnumsInDb1 = [...db2Enums].filter(e => !db1Enums.has(e))
  
  if (missingEnumsInDb2.length > 0) {
    console.log(`  ❌ Missing in ${db2.dbName}: ${missingEnumsInDb2.join(", ")}`)
    hasDifferences = true
  }
  if (missingEnumsInDb1.length > 0) {
    console.log(`  ❌ Missing in ${db1.dbName}: ${missingEnumsInDb1.join(", ")}`)
    hasDifferences = true
  }
  if (missingEnumsInDb2.length === 0 && missingEnumsInDb1.length === 0) {
    console.log(`  ✅ Both databases have: ${db1.paymentEnums.join(", ")}`)
    
    // Compare enum values
    for (const enumName of db1.paymentEnums) {
      const db1Values = db1.enumValues[enumName] || []
      const db2Values = db2.enumValues[enumName] || []
      const db1Set = new Set(db1Values)
      const db2Set = new Set(db2Values)
      
      if (JSON.stringify(db1Values.sort()) !== JSON.stringify(db2Values.sort())) {
        console.log(`  ⚠️  ${enumName} values differ:`)
        console.log(`     ${db1.dbName}: [${db1Values.join(", ")}]`)
        console.log(`     ${db2.dbName}: [${db2Values.join(", ")}]`)
        hasDifferences = true
      }
    }
  }
  
  // Compare columns for each table
  console.log("\n📋 Table Columns:")
  const allTables = new Set([...db1.paymentTables, ...db2.paymentTables])
  
  for (const tableName of allTables) {
    const db1Cols = db1.paymentColumns[tableName] || []
    const db2Cols = db2.paymentColumns[tableName] || []
    
    if (db1Cols.length === 0 && db2Cols.length === 0) continue
    
    const db1ColNames = new Set(db1Cols.map(c => c.column_name))
    const db2ColNames = new Set(db2Cols.map(c => c.column_name))
    
    const missingColsInDb2 = db1Cols.filter(c => !db2ColNames.has(c.column_name))
    const missingColsInDb1 = db2Cols.filter(c => !db1ColNames.has(c.column_name))
    
    if (missingColsInDb2.length > 0 || missingColsInDb1.length > 0) {
      console.log(`  ⚠️  ${tableName} columns differ:`)
      if (missingColsInDb2.length > 0) {
        console.log(`     Missing in ${db2.dbName}: ${missingColsInDb2.map(c => c.column_name).join(", ")}`)
      }
      if (missingColsInDb1.length > 0) {
        console.log(`     Missing in ${db1.dbName}: ${missingColsInDb1.map(c => c.column_name).join(", ")}`)
      }
      hasDifferences = true
    } else if (db1Cols.length > 0 && db2Cols.length > 0) {
      // Compare column properties
      const colDiffs: string[] = []
      for (const col1 of db1Cols) {
        const col2 = db2Cols.find(c => c.column_name === col1.column_name)
        if (col2) {
          if (col1.data_type !== col2.data_type || 
              col1.is_nullable !== col2.is_nullable) {
            colDiffs.push(`${col1.column_name} (type/nullable differ)`)
          }
        }
      }
      if (colDiffs.length > 0) {
        console.log(`  ⚠️  ${tableName} column properties differ: ${colDiffs.join(", ")}`)
        hasDifferences = true
      } else {
        console.log(`  ✅ ${tableName}: columns match`)
      }
    }
  }
  
  // Compare indexes
  console.log("\n📋 Indexes:")
  for (const tableName of allTables) {
    const db1Idx = (db1.paymentIndexes[tableName] || []).map(i => i.indexname).sort()
    const db2Idx = (db2.paymentIndexes[tableName] || []).map(i => i.indexname).sort()
    
    if (JSON.stringify(db1Idx) !== JSON.stringify(db2Idx)) {
      console.log(`  ⚠️  ${tableName} indexes differ:`)
      console.log(`     ${db1.dbName}: [${db1Idx.join(", ")}]`)
      console.log(`     ${db2.dbName}: [${db2Idx.join(", ")}]`)
      hasDifferences = true
    } else if (db1Idx.length > 0) {
      console.log(`  ✅ ${tableName}: indexes match (${db1Idx.length} indexes)`)
    }
  }
  
  // Compare constraints
  console.log("\n📋 Foreign Key Constraints:")
  for (const tableName of allTables) {
    const db1Fks = (db1.paymentConstraints[tableName] || [])
      .filter(c => c.constraint_type === 'FOREIGN KEY')
      .map(c => c.constraint_name)
      .sort()
    const db2Fks = (db2.paymentConstraints[tableName] || [])
      .filter(c => c.constraint_type === 'FOREIGN KEY')
      .map(c => c.constraint_name)
      .sort()
    
    if (JSON.stringify(db1Fks) !== JSON.stringify(db2Fks)) {
      console.log(`  ⚠️  ${tableName} foreign keys differ:`)
      console.log(`     ${db1.dbName}: [${db1Fks.join(", ")}]`)
      console.log(`     ${db2.dbName}: [${db2Fks.join(", ")}]`)
      hasDifferences = true
    } else if (db1Fks.length > 0) {
      console.log(`  ✅ ${tableName}: foreign keys match (${db1Fks.length} FKs)`)
    }
  }
  
  console.log("\n" + "=".repeat(60))
  if (hasDifferences) {
    console.log("❌ DATABASES ARE NOT IN SYNC")
    console.log("=".repeat(60))
    process.exit(1)
  } else {
    console.log("✅ DATABASES ARE IN SYNC!")
    console.log("=".repeat(60))
  }
}

async function main() {
  const args = process.argv.slice(2)
  
  // Get DATABASE_URLs from environment or arguments
  const db1Url = process.env.DATABASE_URL || args[0]
  const db2Url = process.env.DATABASE_URL_STAGING || args[1] || process.env.DATABASE_URL
  
  if (!db1Url) {
    console.error("❌ Error: DATABASE_URL not found")
    console.log("\nUsage:")
    console.log("  DATABASE_URL='url1' DATABASE_URL_STAGING='url2' npx tsx scripts/check-db-sync.ts")
    console.log("  OR")
    console.log("  npx tsx scripts/check-db-sync.ts <database-url-1> <database-url-2>")
    process.exit(1)
  }
  
  if (!db2Url || db2Url === db1Url) {
    console.log("⚠️  Only one DATABASE_URL provided. Checking single database...")
    const prisma1 = new PrismaClient({ datasources: { db: { url: db1Url } } })
    const db1 = await getDatabaseInfo(prisma1, "Database 1")
    await prisma1.$disconnect()
    
    console.log("\n📊 Database Summary:")
    console.log(`  Total tables: ${db1.allTables.length}`)
    console.log(`  Payment tables: ${db1.paymentTables.length} (${db1.paymentTables.join(", ")})`)
    console.log(`  Payment enums: ${db1.paymentEnums.length} (${db1.paymentEnums.join(", ")})`)
    
    if (db1.paymentTables.length === 2 && db1.paymentEnums.length === 2) {
      console.log("\n✅ Payment tables and enums are present!")
    } else {
      console.log("\n⚠️  Some payment objects are missing")
    }
    return
  }
  
  console.log("🔍 Comparing databases...")
  console.log(`  Database 1: ${db1Url.substring(0, 50)}...`)
  console.log(`  Database 2: ${db2Url.substring(0, 50)}...`)
  
  const prisma1 = new PrismaClient({ datasources: { db: { url: db1Url } } })
  const prisma2 = new PrismaClient({ datasources: { db: { url: db2Url } } })
  
  try {
    const db1 = await getDatabaseInfo(prisma1, "Database 1")
    const db2 = await getDatabaseInfo(prisma2, "Database 2")
    
    compareDatabases(db1, db2)
  } finally {
    await prisma1.$disconnect()
    await prisma2.$disconnect()
  }
}

main().catch((e) => {
  console.error("❌ Error:", e)
  process.exit(1)
})
