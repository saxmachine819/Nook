import { prisma } from "../lib/prisma"

async function main() {
  console.log("🔍 Checking for PaymentStatus and RefundStatus enums...\n")
  
  try {
    // Check for PaymentStatus enum
    const paymentStatusCheck = await prisma.$queryRaw<Array<{ typname: string }>>`
      SELECT typname 
      FROM pg_type 
      WHERE typname = 'PaymentStatus'
    `
    
    // Check for RefundStatus enum
    const refundStatusCheck = await prisma.$queryRaw<Array<{ typname: string }>>`
      SELECT typname 
      FROM pg_type 
      WHERE typname = 'RefundStatus'
    `
    
    // Get all enum values for PaymentStatus if it exists
    if (paymentStatusCheck.length > 0) {
      const paymentStatusValues = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
        SELECT e.enumlabel
        FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid  
        WHERE t.typname = 'PaymentStatus'
        ORDER BY e.enumsortorder
      `
      console.log("✅ PaymentStatus enum EXISTS")
      console.log(`   Values: ${paymentStatusValues.map(v => v.enumlabel).join(", ")}`)
    } else {
      console.log("❌ PaymentStatus enum DOES NOT EXIST")
    }
    
    // Get all enum values for RefundStatus if it exists
    if (refundStatusCheck.length > 0) {
      const refundStatusValues = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
        SELECT e.enumlabel
        FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid  
        WHERE t.typname = 'RefundStatus'
        ORDER BY e.enumsortorder
      `
      console.log("\n✅ RefundStatus enum EXISTS")
      console.log(`   Values: ${refundStatusValues.map(v => v.enumlabel).join(", ")}`)
    } else {
      console.log("\n❌ RefundStatus enum DOES NOT EXIST")
    }
    
    // List all custom enums in the database
    const allEnums = await prisma.$queryRaw<Array<{ typname: string }>>`
      SELECT DISTINCT typname 
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid  
      WHERE t.typname NOT LIKE 'pg_%'
      ORDER BY typname
    `
    
    console.log("\n📋 All custom enums in database:")
    allEnums.forEach(e => {
      console.log(`   - ${e.typname}`)
    })
    
    // Check if payments table exists and what type it uses for status
    const paymentsTableCheck = await prisma.$queryRaw<Array<{ 
      column_name: string
      data_type: string
      udt_name: string
    }>>`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'payments'
      AND column_name = 'status'
    `
    
    if (paymentsTableCheck.length > 0) {
      console.log("\n📋 Payments table status column:")
      console.log(`   Column: ${paymentsTableCheck[0].column_name}`)
      console.log(`   Data Type: ${paymentsTableCheck[0].data_type}`)
      console.log(`   UDT Name: ${paymentsTableCheck[0].udt_name}`)
    }
    
    // Check if refund_requests table exists and what type it uses for status
    const refundsTableCheck = await prisma.$queryRaw<Array<{ 
      column_name: string
      data_type: string
      udt_name: string
    }>>`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'refund_requests'
      AND column_name = 'status'
    `
    
    if (refundsTableCheck.length > 0) {
      console.log("\n📋 Refund_requests table status column:")
      console.log(`   Column: ${refundsTableCheck[0].column_name}`)
      console.log(`   Data Type: ${refundsTableCheck[0].data_type}`)
      console.log(`   UDT Name: ${refundsTableCheck[0].udt_name}`)
    }
    
  } catch (error: any) {
    console.error("❌ Error:", error.message)
    throw error
  }
}

main()
  .finally(() => prisma.$disconnect())
