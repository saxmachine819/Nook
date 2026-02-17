import { prisma } from "../lib/prisma"

async function main() {
  try {
    // Check if payments table exists
    const paymentsCheck = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'payments'
    `
    
    // Check if refund_requests table exists
    const refundsCheck = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'refund_requests'
    `
    
    console.log("📊 Database Tables Check:")
    console.log(`  payments: ${paymentsCheck.length > 0 ? "✅ EXISTS" : "❌ MISSING"}`)
    console.log(`  refund_requests: ${refundsCheck.length > 0 ? "✅ EXISTS" : "❌ MISSING"}`)
    
    if (paymentsCheck.length > 0 && refundsCheck.length > 0) {
      console.log("\n✅ Both payment tables exist! Migration successful.")
    } else {
      console.log("\n⚠️  Some tables are missing. Run the migration script.")
    }
  } catch (error: any) {
    console.error("❌ Error checking tables:", error.message)
  }
}

main()
  .finally(() => prisma.$disconnect())
