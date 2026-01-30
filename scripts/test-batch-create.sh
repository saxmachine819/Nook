#!/bin/bash

# Test script for QR Assets Batch Create endpoint
# Usage: ./scripts/test-batch-create.sh [SESSION_TOKEN]

SESSION_TOKEN=${1:-""}
BASE_URL="http://localhost:3000"

if [ -z "$SESSION_TOKEN" ]; then
  echo "❌ Error: Session token required"
  echo ""
  echo "Usage: ./scripts/test-batch-create.sh YOUR_SESSION_TOKEN"
  echo ""
  echo "To get your session token:"
  echo "1. Sign in to your app in the browser"
  echo "2. Open DevTools → Application → Cookies"
  echo "3. Copy the value of 'next-auth.session-token'"
  exit 1
fi

echo "🧪 Testing QR Assets Batch Create Endpoint"
echo "=========================================="
echo ""

# Test 1: Default count (100)
echo "Test 1: Default count (should create 100 tokens)"
echo "-------------------------------------------------"
curl -X POST "${BASE_URL}/api/admin/qr-assets/batch-create" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=${SESSION_TOKEN}" \
  -d '{}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.' || echo "Response received"
echo ""
echo ""

# Test 2: Custom count (10)
echo "Test 2: Custom count of 10"
echo "--------------------------"
curl -X POST "${BASE_URL}/api/admin/qr-assets/batch-create" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=${SESSION_TOKEN}" \
  -d '{"count": 10}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.' || echo "Response received"
echo ""
echo ""

# Test 3: Validation - Over limit (should fail)
echo "Test 3: Validation - Count over limit (should fail with 400)"
echo "------------------------------------------------------------"
curl -X POST "${BASE_URL}/api/admin/qr-assets/batch-create" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=${SESSION_TOKEN}" \
  -d '{"count": 10000}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.' || echo "Response received"
echo ""
echo ""

# Test 4: Validation - Invalid type (should fail)
echo "Test 4: Validation - Invalid type (should fail with 400)"
echo "---------------------------------------------------------"
curl -X POST "${BASE_URL}/api/admin/qr-assets/batch-create" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=${SESSION_TOKEN}" \
  -d '{"count": "invalid"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.' || echo "Response received"
echo ""
echo ""

# Test 5: Unauthorized (no session token)
echo "Test 5: Unauthorized access (should fail with 401)"
echo "---------------------------------------------------"
curl -X POST "${BASE_URL}/api/admin/qr-assets/batch-create" \
  -H "Content-Type: application/json" \
  -d '{"count": 10}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.' || echo "Response received"
echo ""
echo ""

echo "✅ Tests completed!"
echo ""
echo "Next steps:"
echo "1. Check Prisma Studio: npx prisma studio"
echo "2. Verify tokens in qr_assets table"
echo "3. Verify all tokens have status 'UNREGISTERED'"
echo "4. Verify tokens are unique"
