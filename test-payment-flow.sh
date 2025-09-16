#!/bin/bash

# Test Cashfree Payment Flow with curl
# This script tests the complete payment flow

echo "🧪 Testing Cashfree Payment Gateway Integration"
echo "============================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="http://localhost:5000"
AMOUNT="1"
CUSTOMER_NAME="Test User"
CUSTOMER_EMAIL="test@example.com"
CUSTOMER_PHONE="9999999999"

echo -e "${YELLOW}Step 1: Testing Backend Health${NC}"
echo "GET $BACKEND_URL/api/payments/"
curl -s "$BACKEND_URL/api/payments/" | jq .
echo ""

echo -e "${YELLOW}Step 2: Creating Payment Order (₹$AMOUNT)${NC}"
echo "POST $BACKEND_URL/api/payments/create-order"

# Create order and capture response
ORDER_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/payments/create-order" \
  -H "Content-Type: application/json" \
  -d "{
    \"amount\": \"$AMOUNT\",
    \"customerName\": \"$CUSTOMER_NAME\",
    \"customerEmail\": \"$CUSTOMER_EMAIL\",
    \"customerPhone\": \"$CUSTOMER_PHONE\"
  }")

echo "$ORDER_RESPONSE" | jq .
echo ""

# Extract order_id and payment_session_id
ORDER_ID=$(echo "$ORDER_RESPONSE" | jq -r '.data.order_id')
PAYMENT_SESSION_ID=$(echo "$ORDER_RESPONSE" | jq -r '.data.payment_session_id')

if [ "$ORDER_ID" != "null" ] && [ "$ORDER_ID" != "" ]; then
    echo -e "${GREEN}✅ Order created successfully!${NC}"
    echo "Order ID: $ORDER_ID"
    echo "Payment Session ID: ${PAYMENT_SESSION_ID:0:50}..."
    echo ""
    
    echo -e "${YELLOW}Step 3: Payment URL for Manual Testing${NC}"
    echo "You can test the payment manually by visiting:"
    echo "https://sandbox.cashfree.com/pg/view/checkout?order_id=$ORDER_ID"
    echo ""
    
    echo -e "${YELLOW}Step 4: Testing Order Status Check${NC}"
    echo "GET $BACKEND_URL/api/payments/status/$ORDER_ID"
    curl -s "$BACKEND_URL/api/payments/status/$ORDER_ID" | jq .
    echo ""
    
    echo -e "${YELLOW}Step 5: Frontend Integration Test${NC}"
    echo "The frontend should initialize Cashfree with this data:"
    echo "{"
    echo "  paymentSessionId: '$PAYMENT_SESSION_ID',"
    echo "  mode: 'sandbox'"
    echo "}"
    echo ""
    
    # Test production backend if available
    echo -e "${YELLOW}Step 6: Testing Production Backend${NC}"
    PROD_URL="https://surprising-balance-production.up.railway.app"
    echo "POST $PROD_URL/api/payments/create-order"
    
    PROD_RESPONSE=$(curl -s -X POST "$PROD_URL/api/payments/create-order" \
      -H "Content-Type: application/json" \
      -d "{
        \"amount\": \"$AMOUNT\",
        \"customerName\": \"$CUSTOMER_NAME\",
        \"customerEmail\": \"$CUSTOMER_EMAIL\",
        \"customerPhone\": \"$CUSTOMER_PHONE\"
      }")
    
    echo "$PROD_RESPONSE" | jq .
    echo ""
    
    echo -e "${GREEN}🎉 All tests completed!${NC}"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Test manual payment using the Cashfree URL above"
    echo "2. Test frontend integration with the payment session ID"
    echo "3. Verify webhook handling (if implemented)"
    
else
    echo -e "${RED}❌ Order creation failed!${NC}"
    echo "Response: $ORDER_RESPONSE"
fi

echo ""
echo "============================================="
echo "🧪 Test completed"
