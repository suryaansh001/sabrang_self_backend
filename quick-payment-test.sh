#!/bin/bash

# Quick 1 Rupee Payment Test
echo "💳 Creating ₹1 test payment..."

# Create order
RESPONSE=$(curl -s -X POST http://localhost:5000/api/payments/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "1",
    "customerName": "Test User",
    "customerEmail": "test@example.com", 
    "customerPhone": "9999999999"
  }')

echo "Backend Response:"
echo "$RESPONSE" | jq .

# Extract data
ORDER_ID=$(echo "$RESPONSE" | jq -r '.data.order_id')
PAYMENT_SESSION_ID=$(echo "$RESPONSE" | jq -r '.data.payment_session_id')

if [ "$ORDER_ID" != "null" ]; then
    echo ""
    echo "🔗 To complete the ₹1 payment, visit this URL:"
    echo "https://sandbox.cashfree.com/pg/view/checkout?order_id=$ORDER_ID"
    echo ""
    echo "💡 For testing, you can use these dummy card details:"
    echo "Card Number: 4111 1111 1111 1111"
    echo "Expiry: Any future date (e.g., 12/25)"
    echo "CVV: 123"
    echo "Name: Test User"
    echo ""
    echo "🔄 After payment, check status with:"
    echo "curl http://localhost:5000/api/payments/status/$ORDER_ID | jq ."
    echo ""
    echo "Order ID: $ORDER_ID"
    echo "Payment Session ID: ${PAYMENT_SESSION_ID:0:50}..."
fi
